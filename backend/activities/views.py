from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity, ActivityRegistration


class ActivitySerializer(serializers.ModelSerializer):
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
        )


class ActivityListView(generics.ListAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Activity.objects.filter(
            status=Activity.Status.PUBLISHED,
            starts_at__gte=timezone.now(),
        ).order_by("starts_at")


class ActivityRegistrationSerializer(serializers.ModelSerializer):
    activity_title = serializers.CharField(source="activity.title", read_only=True)

    class Meta:
        model = ActivityRegistration
        fields = ("id", "activity", "activity_title", "status", "registered_at")
        read_only_fields = fields


class StudentActivityRegistrationListView(generics.ListAPIView):
    serializer_class = ActivityRegistrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        student = getattr(self.request.user, "student_profile", None)
        if student is None:
            return ActivityRegistration.objects.none()
        return ActivityRegistration.objects.filter(student=student).select_related("activity").order_by("-registered_at")


class ActivityRegistrationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, activity_id):
        student = getattr(request.user, "student_profile", None)
        if student is None:
            return Response(
                {"detail": "Only student accounts can register for activities."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                activity = get_object_or_404(
                    Activity.objects.select_for_update(),
                    id=activity_id,
                    status=Activity.Status.PUBLISHED,
                    starts_at__gte=timezone.now(),
                )
                if activity.fee_kes:
                    return Response(
                        {"detail": "Online payment is not available for paid activities yet."},
                        status=status.HTTP_409_CONFLICT,
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
                    existing.status = ActivityRegistration.Status.REGISTERED
                    existing.cancelled_at = None
                    existing.registered_at = timezone.now()
                    existing.save(update_fields=("status", "cancelled_at", "registered_at"))
                    registration = existing
                    response_status = status.HTTP_200_OK
                else:
                    registration = ActivityRegistration.objects.create(
                        activity=activity,
                        student=student,
                        status=ActivityRegistration.Status.REGISTERED,
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
