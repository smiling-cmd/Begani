import uuid

from django.db import models
from django.utils import timezone

from accounts.models import ClassGroup, User
from config.encrypted import EncryptedTextField


class TherapistProfile(models.Model):
    class Type(models.TextChoices):
        SCHOOL = "school_counsellor", "School Counsellor"
        PRIVATE = "private", "Private Therapist"

    class Category(models.TextChoices):
        COUNSELLOR = "counsellor", "Counsellor"
        PSYCHOLOGIST = "psychologist", "Psychologist"
        PSYCHIATRIST = "psychiatrist", "Psychiatrist"
        SCHOOL_STAFF = "school_staff", "School Staff"

    class Format(models.TextChoices):
        IN_PERSON = "in_person", "In Person"
        ONLINE = "online", "Online"
        BOTH = "both", "Both"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        SUSPENDED = "suspended", "Suspended"
        LEFT = "left", "Left"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="therapist_profile")
    
    type = models.CharField(max_length=30, choices=Type.choices)
    category = models.CharField(max_length=30, choices=Category.choices)
    display_name = models.CharField(max_length=100)
    title = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    approach = models.TextField(blank=True)
    languages = models.CharField(max_length=200, blank=True)
    
    session_length_minutes = models.PositiveIntegerField(default=50)
    format = models.CharField(max_length=20, choices=Format.choices)
    location_text = models.CharField(max_length=255, blank=True)
    
    fee_kes = models.PositiveIntegerField(null=True, blank=True, help_text="Empty for school counsellors")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    def __str__(self):
        return self.display_name


class TherapistVerification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.OneToOneField(TherapistProfile, on_delete=models.CASCADE, related_name="verification")
    
    registration_body = models.CharField(max_length=100)
    registration_number = models.CharField(max_length=100)
    licence_expiry = models.DateField()
    
    # Checkboxes that the admin must tick
    register_checked = models.BooleanField(default=False)
    licence_current = models.BooleanField(default=False)
    category_matches = models.BooleanField(default=False)
    id_matched = models.BooleanField(default=False)
    certificates_seen = models.BooleanField(default=False)
    
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Verification for {self.therapist.display_name}"


class TherapistDocument(models.Model):
    class Type(models.TextChoices):
        ID = "id", "ID"
        SELFIE = "selfie", "Selfie"
        CERTIFICATE = "certificate", "Certificate"
        LICENCE = "licence", "Licence"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="documents")
    type = models.CharField(max_length=20, choices=Type.choices)
    file_reference = models.FileField(upload_to="therapist_docs/")
    uploaded_at = models.DateTimeField(default=timezone.now)
    delete_after = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.type} - {self.therapist.display_name}"


class AvailabilityPattern(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="availability_patterns")
    
    # Stores a list like ["mon", "tue", "wed"]
    days_of_week = models.JSONField(default=list)
    start_time = models.TimeField()
    end_time = models.TimeField()
    weeks = models.PositiveIntegerField(default=1)
    
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Pattern for {self.therapist.display_name}"


class AvailabilitySlot(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        BOOKED = "booked", "Booked"
        REMOVED = "removed", "Removed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="availability_slots")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    pattern = models.ForeignKey(AvailabilityPattern, on_delete=models.SET_NULL, null=True, blank=True, related_name="generated_slots")

    def __str__(self):
        return f"{self.therapist.display_name} @ {self.starts_at}"


class TeachingAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="teaching_assignments")
    class_group = models.ForeignKey(ClassGroup, on_delete=models.CASCADE, related_name="therapists")

    class Meta:
        unique_together = ("therapist", "class_group")

    def __str__(self):
        return f"{self.therapist.display_name} teaches {self.class_group.name}"


class TherapistReport(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        DISMISSED = "dismissed", "Dismissed"
        ACTIONED = "actioned", "Actioned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    therapist = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="reports")
    reporter_student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="submitted_reports")
    
    reason = EncryptedTextField()
    created_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    handled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Report against {self.therapist.display_name}"
