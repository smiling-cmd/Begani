import uuid
from django.db import models
from django.db.models import Q
from django.utils import timezone

from config.encrypted import EncryptedTextField


class PlatformSetting(models.Model):
    key = models.CharField(primary_key=True, max_length=50)
    value = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key} = {self.value}"


class Payment(models.Model):
    class Status(models.TextChoices):
        INITIATED = "initiated", "Initiated"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        TIMED_OUT = "timed_out", "Timed Out"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    registration = models.ForeignKey("activities.ActivityRegistration", null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    
    provider = models.CharField(max_length=20, default="paystack")
    reference = models.CharField(max_length=64, null=True, blank=True, unique=True)
    provider_status = models.CharField(max_length=50, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)

    checkout_request_id = models.CharField(max_length=100, blank=True)
    merchant_request_id = models.CharField(max_length=100, blank=True)
    mpesa_receipt = models.CharField(max_length=100, blank=True)
    result_code = models.CharField(max_length=10, blank=True)
    result_description = models.CharField(max_length=255, blank=True)
    
    phone_masked = models.CharField(max_length=20, blank=True)
    initiated_at = models.DateTimeField(default=timezone.now)
    callback_received_at = models.DateTimeField(null=True, blank=True)
    raw_callback = models.JSONField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(Q(booking__isnull=False, registration__isnull=True) |
                           Q(booking__isnull=True, registration__isnull=False)),
                name="payment_exactly_one_target"
            ),
            # Unique receipt, but allow multiple blank receipts for failed/initiated payments
            models.UniqueConstraint(
                fields=["mpesa_receipt"], 
                condition=~Q(mpesa_receipt=""), 
                name="unique_mpesa_receipt"
            ),
        ]

    def __str__(self):
        return f"Payment {self.id} - {self.amount} KES - {self.status}"


class Refund(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.PROTECT, related_name="refunds")
    registration = models.ForeignKey("activities.ActivityRegistration", null=True, blank=True, on_delete=models.PROTECT, related_name="refunds")
    
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    amount = models.PositiveIntegerField()
    reason = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    mpesa_reference = models.CharField(max_length=100, blank=True)
    requested_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(Q(booking__isnull=False, registration__isnull=True) |
                           Q(booking__isnull=True, registration__isnull=False)),
                name="refund_exactly_one_target"
            ),
        ]

    def __str__(self):
        return f"Refund {self.id} - {self.amount} KES - {self.status}"


class TherapistPayoutAccount(models.Model):
    """Where a private therapist's share is sent (M-Pesa). The number is encrypted at rest."""

    therapist = models.OneToOneField("counsellors.TherapistProfile", on_delete=models.CASCADE, related_name="payout_account")
    phone = EncryptedTextField(help_text="Safaricom number as 2547XXXXXXXX")
    account_name = models.CharField(max_length=120, help_text="Name registered on the M-Pesa line")
    recipient_code = models.CharField(max_length=64, blank=True, help_text="Paystack transfer recipient")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payout account for {self.therapist_id}"


class Payout(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        AWAITING_OTP = "awaiting_otp", "Awaiting OTP"
        PROCESSING = "processing", "Processing"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField("bookings.Booking", on_delete=models.PROTECT, related_name="payout")
    
    gross_kes = models.PositiveIntegerField()
    commission_rate_percent = models.DecimalField(max_digits=5, decimal_places=2)
    commission_kes = models.PositiveIntegerField()
    net_kes = models.PositiveIntegerField()
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    mpesa_reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    transfer_reference = models.CharField(max_length=64, null=True, blank=True, unique=True)
    transfer_code = models.CharField(max_length=64, blank=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # Automatically calculate commission if not set
        if not self.commission_kes:
            self.commission_kes = int(self.gross_kes * (float(self.commission_rate_percent) / 100))
        if not self.net_kes:
            self.net_kes = self.gross_kes - self.commission_kes
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payout {self.id} for Booking {self.booking.id}"


class LedgerEntry(models.Model):
    class Type(models.TextChoices):
        PAYMENT_IN = "payment_in", "Payment In"
        REFUND_OUT = "refund_out", "Refund Out"
        PAYOUT_OUT = "payout_out", "Payout Out"
        COMMISSION = "commission", "Commission"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.PROTECT, related_name="ledger_entries")
    registration = models.ForeignKey("activities.ActivityRegistration", null=True, blank=True, on_delete=models.PROTECT, related_name="ledger_entries")
    
    type = models.CharField(max_length=20, choices=Type.choices)
    amount = models.PositiveIntegerField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(Q(booking__isnull=False, registration__isnull=True) |
                           Q(booking__isnull=True, registration__isnull=False)),
                name="ledger_exactly_one_target"
            ),
        ]
        verbose_name_plural = "Ledger entries"

    def __str__(self):
        return f"{self.type} - {self.amount} KES"
