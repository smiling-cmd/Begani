import uuid
from django.db import models, transaction
from django.utils import timezone
from django.db.models import Q

class Booking(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        CONFIRMED = "confirmed", "Confirmed"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"
        COMPLETED = "completed", "Completed"
        CANCELLED_BY_STUDENT = "cancelled_by_student", "Cancelled by Student"
        CANCELLED_BY_THERAPIST = "cancelled_by_therapist", "Cancelled by Therapist"
        STUDENT_NO_SHOW = "student_no_show", "Student No Show"
        THERAPIST_NO_SHOW = "therapist_no_show", "Therapist No Show"

    ALLOWED = {
        "requested": {"confirmed", "declined", "expired", "cancelled_by_student"},
        "confirmed": {"completed", "cancelled_by_student", "cancelled_by_therapist", "student_no_show", "therapist_no_show"},
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="bookings")
    therapist = models.ForeignKey("counsellors.TherapistProfile", on_delete=models.PROTECT, related_name="bookings")
    slot = models.ForeignKey("counsellors.AvailabilitySlot", on_delete=models.PROTECT, related_name="bookings")
    
    starts_at = models.DateTimeField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.REQUESTED)
    
    fee_kes_snapshot = models.PositiveIntegerField(default=0)
    is_priority = models.BooleanField(default=False)
    
    requested_at = models.DateTimeField(default=timezone.now)
    confirm_by = models.DateTimeField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['slot'],
                condition=Q(status__in=['requested', 'confirmed']),
                name='unique_active_booking_per_slot'
            )
        ]

    def transition(self, to_status, by_user=None, reason=""):
        if to_status not in self.ALLOWED.get(self.status, set()):
            raise ValueError(f"Cannot move from {self.status} to {to_status}")
        
        with transaction.atomic():
            BookingStatusHistory.objects.create(
                booking=self, 
                from_status=self.status, 
                to_status=to_status,
                changed_by=by_user, 
                reason=reason
            )
            self.status = to_status
            if to_status == "confirmed":
                self.confirmed_at = timezone.now()
            if to_status == "completed":
                self.completed_at = timezone.now()
            self.save()

class BookingStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=30)
    to_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(default=timezone.now)
    reason = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Booking status histories"