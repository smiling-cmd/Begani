from decimal import Decimal

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from counsellors.models import TherapistProfile


class TherapistEarningsView(APIView):
    """Return a therapist's earnings, using Payout records when they exist.

    Sessions without a Payout row are reported as an estimate based on the
    configured platform commission so the UI never invents its own rate.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        therapist = getattr(request.user, "therapist_profile", None)
        if therapist is None:
            return Response(
                {"error": "Only therapists can view earnings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if therapist.type == TherapistProfile.Type.SCHOOL:
            return Response(
                {"error": "School counsellor sessions are free, so there are no earnings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        rate = Decimal(str(getattr(settings, "PLATFORM_COMMISSION_PERCENT", "10")))
        bookings = (
            Booking.objects.filter(
                therapist=therapist,
                status=Booking.Status.COMPLETED,
            )
            .select_related("student", "payout")
            .order_by("-starts_at")
        )

        gross_kes = commission_kes = net_kes = paid_kes = 0
        estimated = False
        items = []

        for booking in bookings:
            payout = getattr(booking, "payout", None)
            if payout:
                gross = payout.gross_kes
                commission = payout.commission_kes
                net = payout.net_kes
                payout_status = payout.status
            else:
                estimated = True
                gross = booking.fee_kes_snapshot
                commission = int(gross * rate / 100)
                net = gross - commission
                payout_status = "pending"

            gross_kes += gross
            commission_kes += commission
            net_kes += net
            if payout_status == "paid":
                paid_kes += net

            items.append(
                {
                    "id": str(booking.id),
                    "starts_at": booking.starts_at,
                    "student_alias": booking.student.alias,
                    "gross_kes": gross,
                    "commission_kes": commission,
                    "net_kes": net,
                    "status": payout_status,
                }
            )

        return Response(
            {
                "currency": "KES",
                "commission_rate_percent": str(rate),
                "gross_kes": gross_kes,
                "commission_kes": commission_kes,
                "net_kes": net_kes,
                "paid_kes": paid_kes,
                "pending_kes": max(net_kes - paid_kes, 0),
                "estimated": estimated,
                "items": items,
            }
        )
