import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from activities.models import ActivityRegistration
from bookings.models import Booking

from . import paystack
from .models import LedgerEntry, Payment, Payout, Refund, TherapistPayoutAccount

PENDING_STATES = (Payment.Status.INITIATED, Payment.Status.PENDING)
TIMEOUT = timedelta(minutes=5)
REGISTRATION_HOLD = timedelta(minutes=30)


class PaymentError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def mask_phone(phone):
    return phone[:5] + "****" + phone[-3:]


def _target_filter(booking=None, registration=None):
    return {"booking": booking} if booking else {"registration": registration}


def expire_unpaid_registrations():
    cutoff = timezone.now() - REGISTRATION_HOLD
    stale = ActivityRegistration.objects.filter(
        status=ActivityRegistration.Status.PENDING_PAYMENT, registered_at__lte=cutoff
    ).exclude(payments__status__in=PENDING_STATES)
    stale.update(status=ActivityRegistration.Status.CANCELLED, cancelled_at=timezone.now())


def payment_status_for(obj, fee):
    """free / unpaid / processing / paid for a Booking or ActivityRegistration."""
    if not fee:
        return "free"
    payments = list(obj.payments.all())
    if any(p.status == Payment.Status.SUCCEEDED for p in payments):
        return "paid"
    now = timezone.now()
    if any(p.status in PENDING_STATES and now - p.initiated_at < TIMEOUT for p in payments):
        return "processing"
    return "unpaid"


def start_payment(*, user, phone, booking=None, registration=None):
    normalized = paystack.normalize_phone(phone)
    if not normalized:
        raise PaymentError("Enter a valid Safaricom number, e.g. 0712 345 678.")

    with transaction.atomic():
        if booking:
            booking = Booking.objects.select_for_update().get(pk=booking.pk)
            if booking.status != Booking.Status.CONFIRMED:
                raise PaymentError("You can pay once your counsellor has confirmed the session.", 409)
            if booking.starts_at <= timezone.now():
                raise PaymentError("This session has already started.", 409)
            amount, target = booking.fee_kes_snapshot, booking
        else:
            registration = ActivityRegistration.objects.select_for_update().select_related("activity").get(pk=registration.pk)
            if registration.status != ActivityRegistration.Status.PENDING_PAYMENT:
                raise PaymentError("This registration is not waiting for payment.", 409)
            amount, target = registration.activity.fee_kes, registration
        if amount <= 0:
            raise PaymentError("Nothing to pay for this one.", 409)

        flt = _target_filter(booking, registration)
        if Payment.objects.filter(status=Payment.Status.SUCCEEDED, **flt).exists():
            raise PaymentError("Already paid.", 409)
        now = timezone.now()
        inflight = Payment.objects.filter(status__in=PENDING_STATES, initiated_at__gt=now - TIMEOUT, **flt).first()
        if inflight:
            return inflight

        payment = Payment.objects.create(
            amount=amount,
            reference="bgn_" + uuid.uuid4().hex[:24],
            phone_masked=mask_phone(normalized),
            **flt,
        )

    try:
        data = paystack.charge_mpesa(
            email=user.email, amount_kes=amount, phone=normalized, reference=payment.reference
        )
    except paystack.PaystackNotConfigured:
        payment.status = Payment.Status.FAILED
        payment.result_description = "not configured"
        payment.save(update_fields=("status", "result_description"))
        raise PaymentError("Online payments are not available right now.", 503)
    except paystack.PaystackError as exc:
        payment.status = Payment.Status.FAILED
        payment.result_description = str(exc)[:255]
        payment.save(update_fields=("status", "result_description"))
        raise PaymentError(str(exc), 502)

    payment.provider_status = str(data.get("status", ""))[:50]
    payment.status = Payment.Status.PENDING
    payment.save(update_fields=("provider_status", "status"))
    if data.get("status") in ("success", "failed", "abandoned", "reversed"):
        apply_result(payment.reference, data)
        payment.refresh_from_db()
    return payment


@transaction.atomic
def apply_result(reference, data):
    """Idempotently apply a Paystack transaction result (webhook or verify)."""
    payment = Payment.objects.select_for_update().filter(reference=reference).first()
    if payment is None or payment.status in (Payment.Status.SUCCEEDED, Payment.Status.FAILED, Payment.Status.CANCELLED):
        return payment
    remote = data.get("status", "")
    payment.provider_status = str(remote)[:50]
    payment.last_checked_at = timezone.now()

    if remote == "success":
        if int(data.get("amount", -1)) != payment.amount * 100 or data.get("currency", "KES") != "KES":
            payment.status = Payment.Status.FAILED
            payment.result_description = "amount mismatch"
            payment.save()
            return payment
        payment.status = Payment.Status.SUCCEEDED
        payment.paid_at = timezone.now()
        payment.mpesa_receipt = str(data.get("receipt_number") or "")[:100]
        payment.result_description = "paid"
        payment.callback_received_at = timezone.now()
        payment.save()
        _settle(payment)
    elif remote in ("failed", "abandoned", "reversed"):
        payment.status = Payment.Status.FAILED
        payment.result_description = str(data.get("gateway_response") or remote)[:255]
        payment.save()
    elif timezone.now() - payment.initiated_at > TIMEOUT:
        payment.status = Payment.Status.TIMED_OUT
        payment.save()
    else:
        payment.save()
    return payment


def _settle(payment):
    LedgerEntry.objects.create(
        booking=payment.booking, registration=payment.registration,
        type=LedgerEntry.Type.PAYMENT_IN, amount=payment.amount,
    )
    if payment.booking_id:
        booking = payment.booking
        if booking.status in (Booking.Status.CONFIRMED, Booking.Status.REQUESTED):
            rate = Decimal(str(getattr(settings, "PLATFORM_COMMISSION_PERCENT", "10")))
            Payout.objects.get_or_create(
                booking=booking,
                defaults={"gross_kes": payment.amount, "commission_rate_percent": rate},
            )
        else:
            _create_refund(payment, "Paid after the session was cancelled.")
    else:
        reg = payment.registration
        if reg.status == ActivityRegistration.Status.PENDING_PAYMENT:
            reg.status = ActivityRegistration.Status.REGISTERED
            reg.save(update_fields=("status",))
        elif reg.status == ActivityRegistration.Status.CANCELLED:
            _create_refund(payment, "Paid after the registration was cancelled.")


def _create_refund(payment, reason):
    Refund.objects.get_or_create(
        payment=payment,
        defaults={
            "booking": payment.booking, "registration": payment.registration,
            "amount": payment.amount, "reason": reason,
        },
    )


def request_refund_if_paid(*, booking=None, registration=None, reason):
    """Queue a refund for a succeeded payment; cancel any unpaid payout."""
    payment = Payment.objects.filter(status=Payment.Status.SUCCEEDED, **_target_filter(booking, registration)).first()
    if not payment:
        return None
    if booking:
        Payout.objects.filter(booking=booking, status=Payout.Status.PENDING).delete()
    _create_refund(payment, reason)
    return payment


def refresh_payment(payment):
    """Poll fallback: ask Paystack (needed on localhost where webhooks can't arrive)."""
    if payment.status not in PENDING_STATES:
        return payment
    if payment.last_checked_at and timezone.now() - payment.last_checked_at < timedelta(seconds=2):
        return payment
    try:
        data = paystack.verify(payment.reference)
    except paystack.PaystackError:
        payment.last_checked_at = timezone.now()
        payment.save(update_fields=("last_checked_at",))
        if timezone.now() - payment.initiated_at > TIMEOUT:
            apply_result(payment.reference, {"status": "pending"})
            payment.refresh_from_db()
        return payment
    apply_result(payment.reference, data)
    payment.refresh_from_db()
    return payment


# ---- Payouts to therapists ---------------------------------------------------------------

class PayoutError(Exception):
    pass


def payable_payouts():
    """Pending payouts for completed sessions whose therapist has a payout number."""
    return Payout.objects.filter(
        status=Payout.Status.PENDING,
        booking__status=Booking.Status.COMPLETED,
        booking__therapist__payout_account__isnull=False,
    ).select_related("booking", "booking__therapist", "booking__therapist__payout_account")


def mark_payout_paid(payout, reference=""):
    """Idempotent: write ledger entries only the first time a payout becomes paid."""
    if payout.status == Payout.Status.PAID:
        return payout
    payout.status = Payout.Status.PAID
    payout.paid_at = timezone.now()
    payout.failure_reason = ""
    if reference:
        payout.mpesa_reference = reference[:100]
    payout.save(update_fields=("status", "paid_at", "failure_reason", "mpesa_reference"))
    LedgerEntry.objects.create(booking=payout.booking, type=LedgerEntry.Type.PAYOUT_OUT, amount=payout.net_kes)
    LedgerEntry.objects.create(booking=payout.booking, type=LedgerEntry.Type.COMMISSION, amount=payout.commission_kes)
    return payout


def _apply_transfer_status(payout, data):
    status = data.get("status")
    payout.transfer_code = data.get("transfer_code") or payout.transfer_code
    if status == "success":
        payout.save(update_fields=("transfer_code",))
        mark_payout_paid(payout, data.get("reference") or "")
    elif status == "otp":
        payout.status = Payout.Status.AWAITING_OTP
        payout.save(update_fields=("status", "transfer_code"))
    elif status in ("failed", "reversed"):
        payout.status = Payout.Status.PENDING
        payout.failure_reason = str(data.get("reason") or data.get("message") or status)[:255]
        payout.save(update_fields=("status", "transfer_code", "failure_reason"))
    else:  # pending / received / queued
        payout.status = Payout.Status.PROCESSING
        payout.save(update_fields=("status", "transfer_code"))


def send_payout(payout_id):
    """Start the Paystack transfer for one payout. Raises PayoutError with a plain reason."""
    error = None
    with transaction.atomic():
        payout = Payout.objects.select_for_update().select_related("booking__therapist").get(pk=payout_id)
        if payout.status != Payout.Status.PENDING:
            raise PayoutError("Already sent or paid.")
        if payout.booking.status != Booking.Status.COMPLETED:
            raise PayoutError("The session isn't marked completed.")
        account = TherapistPayoutAccount.objects.filter(therapist=payout.booking.therapist).first()
        if account is None:
            raise PayoutError("The therapist hasn't added a payout number.")
        try:
            if not account.recipient_code:
                account.recipient_code = paystack.create_recipient(name=account.account_name, phone_e164="+" + account.phone)
                account.save(update_fields=("recipient_code",))
            payout.transfer_reference = "po_" + uuid.uuid4().hex[:24]
            payout.last_attempt_at = timezone.now()
            payout.failure_reason = ""
            payout.save(update_fields=("transfer_reference", "last_attempt_at", "failure_reason"))
            data = paystack.initiate_transfer(
                amount_kes=payout.net_kes, recipient_code=account.recipient_code,
                reference=payout.transfer_reference, reason="Begani session payout",
            )
        except paystack.PaystackError as exc:
            error = str(exc)
        else:
            _apply_transfer_status(payout, data)
    if error:
        # Saved outside the transaction so the reason survives. If the error says Paystack
        # could not be reached, check Paystack > Transfers before retrying (the transfer may have gone through).
        Payout.objects.filter(pk=payout_id).update(failure_reason=error[:255])
        raise PayoutError(error)
    payout.refresh_from_db()
    return payout


def finalize_payout(payout_id, otp):
    with transaction.atomic():
        payout = Payout.objects.select_for_update().select_related("booking").get(pk=payout_id)
        if payout.status != Payout.Status.AWAITING_OTP or not payout.transfer_code:
            raise PayoutError("Not waiting for an OTP.")
        try:
            data = paystack.finalize_transfer(transfer_code=payout.transfer_code, otp=otp)
        except paystack.PaystackError as exc:
            raise PayoutError(str(exc))
        data = {**data, "transfer_code": payout.transfer_code}
        _apply_transfer_status(payout, data)
    return payout


def apply_transfer_event(data):
    """Handle transfer.success / transfer.failed / transfer.reversed webhooks (idempotent)."""
    reference = data.get("reference")
    if not reference:
        return None
    with transaction.atomic():
        payout = Payout.objects.select_for_update().filter(transfer_reference=reference).first()
        if payout is None or payout.status == Payout.Status.PAID:
            return payout
        _apply_transfer_status(payout, data)
    return payout
