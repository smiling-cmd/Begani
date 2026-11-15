from django.db import models

# Create your models here.
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from encrypted_fields.fields import EncryptedTextField


class ChatThread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="threads")
    therapist = models.ForeignKey("counsellors.TherapistProfile", on_delete=models.PROTECT, related_name="threads")
    intro_limit = models.PositiveIntegerField(
        null=True, blank=True, help_text="10 for private therapists; empty = unlimited (school)")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "therapist"], name="one_thread_per_pair")
        ]

    def lock_state(self, sender_user):
        """Derived at send time, never stored. Returns 'open' or 'locked'."""
        from bookings.models import Booking

        bookings = Booking.objects.filter(student=self.student, therapist=self.therapist)

        # 1. An active booking decides everything
        active = bookings.filter(status__in=["requested", "confirmed"]).order_by("-requested_at").first()
        if active:
            return "locked" if active.status == "requested" else "open"

        # 2. After a completed session the chat stays open for 7 days
        done = bookings.filter(status="completed").order_by("-completed_at").first()
        if done and done.completed_at and timezone.now() < done.completed_at + timedelta(days=7):
            return "open"

        # 3. Otherwise the intro limit applies (only text messages count)
        if self.intro_limit is not None:
            sent = ChatMessage.objects.filter(
                thread=self,
                sender=sender_user,
                kind=ChatMessage.Kind.TEXT,
            ).count()
            if sent >= self.intro_limit:
                return "locked"
        return "open"

    def __str__(self):
        return f"{self.student.alias} / {self.therapist.display_name}"


class ChatMessage(models.Model):
    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        SYSTEM = "system", "System"
        BOOKING_INVITE = "booking_invite", "Booking invite"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="+")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.TEXT)
    body = EncryptedTextField()
    sent_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sent_at"]

    def __str__(self):
        thread_id = self.thread.id if self.thread else "unknown thread"
        return f"{self.kind} in {thread_id}"
