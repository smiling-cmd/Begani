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


# ---- Paystack payments -------------------------------------------------

import json  # noqa: E402

from django.shortcuts import get_object_or_404  # noqa: E402
from rest_framework import status as http  # noqa: E402
from rest_framework.permissions import AllowAny, IsAuthenticated as _IsAuth  # noqa: E402
from rest_framework.response import Response as _Resp  # noqa: E402
from rest_framework.views import APIView as _APIView  # noqa: E402

from accounts.throttles import PaymentStartThrottle  # noqa: E402
from activities.models import ActivityRegistration  # noqa: E402
from bookings.models import Booking  # noqa: E402

from . import paystack, services  # noqa: E402
from .models import Payment  # noqa: E402


def _payment_payload(payment):
    return {
        "id": str(payment.id),
        "status": payment.status,
        "amount": payment.amount,
        "phone_masked": payment.phone_masked,
        "initiated_at": payment.initiated_at,
        "message": payment.result_description if payment.status == Payment.Status.FAILED else "",
    }


class _StartPaymentBase(_APIView):
    permission_classes = [_IsAuth]
    throttle_classes = [PaymentStartThrottle]

    def start(self, request, **target):
        try:
            payment = services.start_payment(user=request.user, phone=request.data.get("phone", ""), **target)
        except services.PaymentError as exc:
            return _Resp({"detail": str(exc)}, status=exc.status)
        return _Resp(_payment_payload(payment), status=http.HTTP_201_CREATED)


class BookingPayView(_StartPaymentBase):
    def post(self, request, pk):
        student = getattr(request.user, "student_profile", None)
        booking = get_object_or_404(Booking, pk=pk, student=student) if student else None
        if booking is None:
            return _Resp({"detail": "Appointment not found."}, status=404)
        return self.start(request, booking=booking)


class RegistrationPayView(_StartPaymentBase):
    def post(self, request, pk):
        student = getattr(request.user, "student_profile", None)
        reg = get_object_or_404(ActivityRegistration, pk=pk, student=student) if student else None
        if reg is None:
            return _Resp({"detail": "Registration not found."}, status=404)
        return self.start(request, registration=reg)


class PaymentStatusView(_APIView):
    permission_classes = [_IsAuth]

    def get(self, request, pk):
        student = getattr(request.user, "student_profile", None)
        payment = Payment.objects.filter(pk=pk).first()
        owner_ok = payment and student and (
            (payment.booking_id and payment.booking.student_id == student.pk)
            or (payment.registration_id and payment.registration.student_id == student.pk)
        )
        if not owner_ok:
            return _Resp({"detail": "Payment not found."}, status=404)
        payment = services.refresh_payment(payment)
        return _Resp(_payment_payload(payment))


class PaystackWebhookView(_APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        if not paystack.valid_signature(request.body, request.headers.get("x-paystack-signature", "")):
            return _Resp(status=401)
        try:
            event = json.loads(request.body)
        except ValueError:
            return _Resp(status=400)
        data = event.get("data") or {}
        if event.get("event") in ("charge.success", "charge.failed") and data.get("reference"):
            services.apply_result(data["reference"], data)
        return _Resp(status=200)

