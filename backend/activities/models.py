import uuid
from django.db import models
from django.utils import timezone


class Activity(models.Model):
    class Type(models.TextChoices):
        HIKING = "hiking", "Hiking"
        PAINTING = "painting", "Painting"
        YOGA = "yoga", "Yoga"
        MUSIC = "music", "Music"
        READING_CLUB = "reading_club", "Reading Club"
        GROUP_TALK = "group_talk", "Group Talk"
        MINDFULNESS = "mindfulness", "Mindfulness"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PUBLISHED = "published", "Published"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=30, choices=Type.choices)
    description = models.TextField(blank=True)
    
    starts_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location_text = models.CharField(max_length=255)
    
    capacity = models.PositiveIntegerField()
    fee_kes = models.PositiveIntegerField(default=0, help_text="0 means free")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="created_activities")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "Activities"

    def __str__(self):
        return self.title


class ActivityRegistration(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "Pending Payment"
        REGISTERED = "registered", "Registered"
        CANCELLED = "cancelled", "Cancelled"
        ATTENDED = "attended", "Attended"
        NO_SHOW = "no_show", "No Show"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="registrations")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="activity_registrations")
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REGISTERED)
    registered_at = models.DateTimeField(default=timezone.now)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # A student can only register once per activity
        constraints = [
            models.UniqueConstraint(fields=["activity", "student"], name="unique_activity_registration")
        ]

    def __str__(self):
        return f"{self.student.alias} - {self.activity.title}"


class FreePass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="free_passes")
    
    # The registration where they no-showed
    earned_from_registration = models.OneToOneField(ActivityRegistration, on_delete=models.PROTECT, related_name="earned_free_pass")
    
    # The activity type they can use it on
    activity_type = models.CharField(max_length=30, choices=Activity.Type.choices)
    
    # The registration where they redeemed it (null until used)
    redeemed_registration = models.OneToOneField(ActivityRegistration, on_delete=models.SET_NULL, null=True, blank=True, related_name="redeemed_free_pass")
    
    created_at = models.DateTimeField(default=timezone.now)
    redeemed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Free Pass for {self.student.alias} - {self.activity_type}"
