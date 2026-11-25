import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from calendar import month_abbr
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncMonth

from messaging.models import ChatThread

from .models import Booking, expire_stale_bookings
from .serializers import (
    BookingCreateSerializer,
    StudentAppointmentSerializer,
    StudentBookingSerializer,
    TherapistBookingSerializer,
)

logger = logging.getLogger(__name__)

# --- 1. The View to CREATE a booking (Student side) ---
class BookingCreateView(generics.CreateAPIView):
    serializer_class = BookingCreateSerializer
    permission_classes = [IsAuthenticated]


# --- 1b. The View to LIST a student's upcoming bookings (Student side) ---
class StudentBookingListView(generics.ListAPIView):
    serializer_class = StudentBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        student_profile = getattr(self.request.user, 'student_profile', None)
        if not student_profile:
            return Booking.objects.none()
        expire_stale_bookings()
        return (
            Booking.objects.filter(
                student=student_profile,
                status__in=[Booking.Status.REQUESTED, Booking.Status.CONFIRMED],
                starts_at__gte=timezone.now(),
            )
            .select_related('therapist')
            .order_by('starts_at')
        )


# --- 1c. Every appointment a student has made, newest first ---
class StudentAppointmentListView(generics.ListAPIView):
    serializer_class = StudentAppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        student_profile = getattr(self.request.user, 'student_profile', None)
        if not student_profile:
            return Booking.objects.none()
        expire_stale_bookings()
        return (
            Booking.objects.filter(student=student_profile)
            .select_related('therapist', 'therapist__user')
            .order_by('-starts_at')[:200]
        )


# --- 1d. A student cancels their own request or upcoming appointment ---
class StudentBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        student_profile = getattr(request.user, 'student_profile', None)
        booking = (
            Booking.objects.select_related('therapist', 'therapist__user')
            .filter(id=pk, student=student_profile)
            .first()
            if student_profile
            else None
        )
        if booking is None:
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)
        if booking.status not in (Booking.Status.REQUESTED, Booking.Status.CONFIRMED):
            return Response({"error": "This appointment can no longer be cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        if booking.starts_at <= timezone.now():
            return Response({"error": "This appointment has already started."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            booking.transition(Booking.Status.CANCELLED_BY_STUDENT, by_user=request.user, reason="Cancelled by student.")
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        from payments.services import request_refund_if_paid
        request_refund_if_paid(booking=booking, reason="Cancelled by student.")
        booking.refresh_from_db()
        return Response(StudentAppointmentSerializer(booking).data)


# --- 2. The View to LIST bookings (Therapist side) ---
class TherapistBookingListView(generics.ListAPIView):
    serializer_class = TherapistBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        therapist_profile = getattr(self.request.user, 'therapist_profile', None)
        if not therapist_profile:
            return Booking.objects.none()
        expire_stale_bookings()
        return Booking.objects.filter(therapist=therapist_profile).order_by('-requested_at')


# --- 2b. Aggregated, anonymised practice stats (Therapist side) ---
class TherapistInsightsView(APIView):
    """Real counts for the Insights page: volume, pipeline and school mix.

    No student names or contact details are exposed, only aliases are used
    elsewhere and this endpoint returns aggregates only.
    """

    permission_classes = [IsAuthenticated]
    # A class with fewer students than this is folded into "Other groups" so nobody can be picked out.
    MIN_GROUP_STUDENTS = 3
    EXCLUDED_STATUSES = (
        Booking.Status.DECLINED,
        Booking.Status.EXPIRED,
        Booking.Status.CANCELLED_BY_STUDENT,
        Booking.Status.CANCELLED_BY_THERAPIST,
    )

    def get(self, request):
        therapist = getattr(request.user, "therapist_profile", None)
        if therapist is None:
            return Response(
                {"error": "Only therapists can view insights."},
                status=status.HTTP_403_FORBIDDEN,
            )

        expire_stale_bookings()
        now = timezone.now()
        year = now.year
        bookings = Booking.objects.filter(therapist=therapist)
        counted = bookings.exclude(status__in=self.EXCLUDED_STATUSES)

        rows = (
            counted.filter(starts_at__year=year)
            .annotate(month=TruncMonth("starts_at"))
            .values("month")
            .annotate(count=Count("id"))
        )
        counts_by_month = {
            row["month"].month: row["count"] for row in rows if row["month"]
        }
        monthly = [
            {"month": month, "label": month_abbr[month], "count": counts_by_month.get(month, 0)}
            for month in range(1, now.month + 1)
        ]

        rows = (
            counted.values("student__class_group__university__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        highest = max((row["count"] for row in rows), default=0)
        schools = [
            {
                "name": row["student__class_group__university__name"] or "Not provided",
                "count": row["count"],
                "percentage": round(row["count"] / highest * 100) if highest else 0,
            }
            for row in rows
        ]

        audience = "school" if therapist.type == therapist.Type.SCHOOL else "private"
        groups = []
        if audience == "school":
            class_rows = (
                counted.values("student__class_group__name")
                .annotate(count=Count("id"), students=Count("student", distinct=True))
                .order_by("-count")
            )
            other = 0
            for row in class_rows:
                if row["students"] < self.MIN_GROUP_STUDENTS:
                    other += row["count"]
                else:
                    groups.append({"name": row["student__class_group__name"] or "Not provided", "count": row["count"]})
            if other:
                groups.append({"name": "Other groups", "count": other})
            top = max((group["count"] for group in groups), default=0)
            for group in groups:
                group["percentage"] = round(group["count"] / top * 100) if top else 0

        ongoing_chats = (
            ChatThread.objects.filter(
                therapist=therapist,
                messages__sent_at__gte=now - timedelta(days=7),
            )
            .distinct()
            .count()
        )

        return Response(
            {
                "year": year,
                "booked_this_year": counted.filter(starts_at__year=year).count(),
                "awaiting_confirmation": bookings.filter(status=Booking.Status.REQUESTED).count(),
                "upcoming_appointments": bookings.filter(
                    status=Booking.Status.CONFIRMED,
                    starts_at__gte=now,
                ).count(),
                "ongoing_chats": ongoing_chats,
                "monthly": monthly,
                "audience": audience,
                "schools": schools if audience == "private" else [],
                "groups": groups,
            }
        )


# --- 3. The View to UPDATE status (Therapist side) ---
class BookingStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(id=pk)
            therapist_profile = getattr(request.user, 'therapist_profile', None)
            
            if booking.therapist != therapist_profile:
                return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

            new_status = request.data.get('status')
            if new_status not in ['confirmed', 'declined', 'completed', 'cancelled_by_therapist']:
                return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

            # Use the custom transition method
            transition_method = getattr(booking, "transition", None)
            if transition_method is None:
                return Response({"error": "Booking transition is not available"}, status=status.HTTP_400_BAD_REQUEST)

            transition_method(new_status, by_user=request.user)
            if new_status == 'cancelled_by_therapist':
                from payments.services import request_refund_if_paid
                request_refund_if_paid(booking=booking, reason="Cancelled by therapist.")

            return Response({"message": f"Booking {new_status} successfully."})
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("Unexpected error updating booking %s", pk)
            return Response(
                {"error": "Could not update this booking. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )