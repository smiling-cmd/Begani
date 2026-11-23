import uuid
from django.db import models
from django.utils import timezone

from config.encrypted import EncryptedTextField


class TuaConversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="tua_conversations")
    title = models.CharField(max_length=200, blank=True)
    saved = models.BooleanField(default=False, help_text="If false, deleted after 90 days")
    started_at = models.DateTimeField(default=timezone.now)
    last_message_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Tua Chat {self.id}"


class TuaMessage(models.Model):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TUA = "tua", "Tua"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(TuaConversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=Role.choices)
    content = EncryptedTextField(help_text="Encrypted at rest in Begani's database; not end-to-end encrypted")
    model_name = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=50, blank=True)
    safety_label = models.CharField(max_length=50, blank=True, help_text="e.g., distress, crisis")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:20]}..."


class TuaRecommendation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(TuaMessage, on_delete=models.CASCADE, related_name="recommendations")
    therapist = models.ForeignKey("counsellors.TherapistProfile", on_delete=models.CASCADE)
    reason_tag = models.CharField(max_length=100, blank=True)
    shown_at = models.DateTimeField(default=timezone.now)
    opened_profile_at = models.DateTimeField(null=True, blank=True)
    opened_chat_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Tua suggested {self.therapist.display_name}"


class SafetyEvent(models.Model):
    class Level(models.TextChoices):
        DISTRESS = "distress", "Distress"
        CRISIS = "crisis", "Crisis"

    class DetectedBy(models.TextChoices):
        RULES = "rules", "Rules"
        MODEL = "model", "Model"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(TuaConversation, on_delete=models.CASCADE, related_name="safety_events")
    message = models.ForeignKey(TuaMessage, on_delete=models.CASCADE, null=True, blank=True)
    level = models.CharField(max_length=20, choices=Level.choices)
    resources_shown = models.BooleanField(default=True)
    detected_by = models.CharField(max_length=20, choices=DetectedBy.choices)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Safety Event: {self.level}"


class PriorityRequest(models.Model):
    class Source(models.TextChoices):
        TUA = "tua", "Tua"
        FIND_SUPPORT = "find_support", "Find Support"

    class ProviderType(models.TextChoices):
        SCHOOL = "school_counsellor", "School Counsellor"
        PRIVATE = "private", "Private Therapist"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACCEPTED = "accepted", "Accepted"
        BOOKED = "booked", "Booked"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="priority_requests")
    source = models.CharField(max_length=20, choices=Source.choices)
    
    # Reference only, no text copied
    tua_conversation = models.ForeignKey(TuaConversation, on_delete=models.SET_NULL, null=True, blank=True)
    
    provider_type = models.CharField(max_length=30, choices=ProviderType.choices)
    therapist = models.ForeignKey("counsellors.TherapistProfile", on_delete=models.SET_NULL, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    
    # Consent and contact
    consent_at = models.DateTimeField(help_text="Required. When the student tapped the button.")
    phone_consent = models.BooleanField(default=False, help_text="Only place a phone number can be shared")
    student_note = EncryptedTextField(blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    respond_by = models.DateTimeField(help_text="created_at + 15 minutes")
    responded_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Priority Request for {self.student.alias} - {self.status}"