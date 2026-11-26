from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsUniversityAdmin
from administration.audit import log_admin_action
from payments.services import expire_unpaid_registrations, payment_status_for, request_refund_if_paid
from .models import Activity, ActivityRegistration


class ActivitySerializer(serializers.ModelSerializer):
    spots_left = serializers.SerializerMethodField()

    def get_spots_left(self, obj):
        taken = obj.registrations.filter(
            status__in=(ActivityRegistration.Status.REGISTERED, ActivityRegistration.Status.PENDING_PAYMENT)
        ).count()
        return max(obj.capacity - taken, 0)

    class Meta:
        model = Activity
        fields = (
            "id",
            "title",
            "type",
            "description",
            "starts_at",
            "duration_minutes",
            "location_text",
            "capacity",
            "fee_kes",
            "spots_left",
        )


class ActivityListView(generics.ListAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Activity.objects.filter(
            status=Activity.Status.PUBLISHED,
            starts_at__gte=timezone.now(),
        ).order_by("starts_at")


class AdminActivityCreateSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Activity
        fields = (
            "id",
            "title",
            "type",
            "description",
            "starts_at",
            "duration_minutes",
            "location_text",
            "capacity",
            "fee_kes",
            "status",
        )

    def validate_starts_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Choose a future start date and time.")
        return value

    def validate_duration_minutes(self, value):
        if value < 1:
            raise serializers.ValidationError("Duration must be at least one minute.")
        return value

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError("Capacity must be at least one.")
        return value


class AdminActivityCreateView(generics.CreateAPIView):
    queryset = Activity.objects.all()
    serializer_class = AdminActivityCreateSerializer
    permission_classes = [IsUniversityAdmin]

    def perform_create(self, serializer):
        serializer.save(
            status=Activity.Status.PUBLISHED,
            created_by=self.request.user,
        )


ACTIVE_REGISTRATION = (ActivityRegistration.Status.REGISTERED, ActivityRegistration.Status.PENDING_PAYMENT)


class AdminActivitySerializer(AdminActivityCreateSerializer):
    """Admin list/edit shape: the create fields plus how many places are taken."""
    status = serializers.CharField(read_only=True)
    taken = serializers.SerializerMethodField()
    registrations_total = serializers.SerializerMethodField()

    class Meta(AdminActivityCreateSerializer.Meta):
        fields = AdminActivityCreateSerializer.Meta.fields + ("taken", "registrations_total")

    def get_taken(self, obj):
        return obj.registrations.filter(status__in=ACTIVE_REGISTRATION).count()

    def get_registrations_total(self, obj):
        return obj.registrations.count()

    def validate_starts_at(self, value):
        # When editing, only insist on a future date if the date is actually being changed.
        if self.instance is not None and value == self.instance.starts_at:
            return value
        return super().validate_starts_at(value)

    def validate_capacity(self, value):
        value = super().validate_capacity(value)
        if self.instance is not None:
            taken = self.instance.registrations.filter(status__in=ACTIVE_REGISTRATION).count()
            if value < taken:
                raise serializers.ValidationError(f"{taken} students are already registered. Capacity can't go below that.")
        return value


class AdminActivityListView(generics.ListAPIView):
    serializer_class = AdminActivitySerializer
    permission_classes = [IsUniversityAdmin]

    def get_queryset(self):
        return Activity.objects.prefetch_related("registrations").order_by("-starts_at")


class AdminActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Activity.objects.all()
    serializer_class = AdminActivitySerializer
    permission_classes = [IsUniversityAdmin]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def perform_update(self, serializer):
        serializer.save()
        log_admin_action(self.request, "activity.update", "Activity", serializer.instance.id)

    def destroy(self, request, *args, **kwargs):
        activity = self.get_object()
        if activity.registrations.exists():
            return Response(
                {"detail": "Students have registered for this activity, so it can't be deleted. Cancel it instead, which releases places and queues refunds for paid ones."},
                status=status.HTTP_409_CONFLICT,
            )
        log_admin_action(request, "activity.delete", "Activity", activity.id)
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminActivityCancelView(APIView):
    """Cancel an activity: hide it from students, release every place, queue refunds for paid ones."""

    permission_classes = [IsUniversityAdmin]

    def post(self, request, activity_id):
        with transaction.atomic():
            activity = get_object_or_404(Activity.objects.select_for_update(), id=activity_id)
            if activity.status == Activity.Status.CANCELLED:
                return Response({"detail": "This activity is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)
            activity.status = Activity.Status.CANCELLED
            activity.save(update_fields=("status",))
            now = timezone.now()
            released = 0
            for registration in activity.registrations.filter(status__in=ACTIVE_REGISTRATION):
                registration.status = ActivityRegistration.Status.CANCELLED
                registration.cancelled_at = now
                registration.save(update_fields=("status", "cancelled_at"))
                request_refund_if_paid(registration=registration, reason="Activity cancelled by organisers.")
                released += 1
        log_admin_action(request, "activity.cancel", "Activity", activity.id)
        return Response({"message": f"Activity cancelled. {released} registration(s) released.", "released": released})


class ActivityRegistrationSerializer(serializers.ModelSerializer):
    activity_title = serializers.CharField(source="activity.title", read_only=True)
    activity_starts_at = serializers.DateTimeField(source="activity.starts_at", read_only=True)
    activity_duration_minutes = serializers.IntegerField(
        source="activity.duration_minutes",
        read_only=True,
    )
    location_text = serializers.CharField(source="activity.location_text", read_only=True)
    fee_kes = serializers.IntegerField(source="activity.fee_kes", read_only=True)
    payment_status = serializers.SerializerMethodField()

    def get_payment_status(self, obj):
        return payment_status_for(obj, obj.activity.fee_kes)

    class Meta:
        model = ActivityRegistration
        fields = (
            "id",
            "activity",
            "activity_title",
            "activity_starts_at",
            "activity_duration_minutes",
            "location_text",
            "status",
            "registered_at",
            "fee_kes",
            "payment_status",
        )
        read_only_fields = fields


class StudentActivityRegistrationListView(generics.ListAPIView):
    serializer_class = ActivityRegistrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        student = getattr(self.request.user, "student_profile", None)
        if student is None:
            return ActivityRegistration.objects.none()
        expire_unpaid_registrations()
        return (
            ActivityRegistration.objects.filter(student=student)
            .select_related("activity")
            .prefetch_related("payments")
            .order_by("-registered_at")
        )


class ActivityRegistrationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, activity_id):
        student = getattr(request.user, "student_profile", None)
        if student is None:
            return Response(
                {"detail": "Only student accounts can register for activities."},
                status=status.HTTP_403_FORBIDDEN,
            )
        expire_unpaid_registrations()

        try:
            with transaction.atomic():
                activity = get_object_or_404(
                    Activity.objects.select_for_update(),
                    id=activity_id,
                    status=Activity.Status.PUBLISHED,
                    starts_at__gte=timezone.now(),
                )
                initial_status = (
                    ActivityRegistration.Status.PENDING_PAYMENT
                    if activity.fee_kes
                    else ActivityRegistration.Status.REGISTERED
                )

                existing = ActivityRegistration.objects.filter(activity=activity, student=student).first()
                if existing and existing.status in (
                    ActivityRegistration.Status.REGISTERED,
                    ActivityRegistration.Status.PENDING_PAYMENT,
                ):
                    return Response(ActivityRegistrationSerializer(existing).data, status=status.HTTP_200_OK)
                if existing and existing.status != ActivityRegistration.Status.CANCELLED:
                    return Response(
                        {"detail": "This activity registration can no longer be changed."},
                        status=status.HTTP_409_CONFLICT,
                    )

                active_statuses = (
                    ActivityRegistration.Status.REGISTERED,
                    ActivityRegistration.Status.PENDING_PAYMENT,
                )
                registration_count = ActivityRegistration.objects.filter(
                    activity=activity,
                    status__in=active_statuses,
                ).count()
                if registration_count >= activity.capacity:
                    return Response(
                        {"detail": "This activity is full."},
                        status=status.HTTP_409_CONFLICT,
                    )

                if existing:
                    existing.status = initial_status
                    existing.cancelled_at = None
                    existing.registered_at = timezone.now()
                    existing.save(update_fields=("status", "cancelled_at", "registered_at"))
                    registration = existing
                    response_status = status.HTTP_200_OK
                else:
                    registration = ActivityRegistration.objects.create(
                        activity=activity,
                        student=student,
                        status=initial_status,
                    )
                    response_status = status.HTTP_201_CREATED
        except IntegrityError:
            registration = ActivityRegistration.objects.filter(activity_id=activity_id, student=student).first()
            if registration and registration.status in (
                ActivityRegistration.Status.REGISTERED,
                ActivityRegistration.Status.PENDING_PAYMENT,
            ):
                return Response(ActivityRegistrationSerializer(registration).data, status=status.HTTP_200_OK)
            return Response(
                {"detail": "This activity registration could not be completed. Please try again."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(ActivityRegistrationSerializer(registration).data, status=response_status)


class ActivityRegistrationCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, registration_id):
        student = getattr(request.user, "student_profile", None)
        if student is None:
            return Response(
                {"detail": "Only student accounts can cancel activity registrations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            registration = get_object_or_404(
                ActivityRegistration.objects.select_for_update().select_related("activity"),
                id=registration_id,
                student=student,
            )

            if registration.status == ActivityRegistration.Status.CANCELLED:
                return Response(ActivityRegistrationSerializer(registration).data)

            if registration.status not in (
                ActivityRegistration.Status.REGISTERED,
                ActivityRegistration.Status.PENDING_PAYMENT,
            ):
                return Response(
                    {"detail": "This activity registration can no longer be changed."},
                    status=status.HTTP_409_CONFLICT,
                )

            if registration.activity.starts_at <= timezone.now():
                return Response(
                    {"detail": "This activity has already started."},
                    status=status.HTTP_409_CONFLICT,
                )

            registration.status = ActivityRegistration.Status.CANCELLED
            registration.cancelled_at = timezone.now()
            registration.save(update_fields=("status", "cancelled_at"))
            request_refund_if_paid(registration=registration, reason="Cancelled by student.")

        return Response(ActivityRegistrationSerializer(registration).data)