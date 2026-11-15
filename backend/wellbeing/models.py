import uuid
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class MoodCheckin(models.Model):
    class Source(models.TextChoices):
        HOME = "home", "Home"
        WELLBEING = "wellbeing", "Wellbeing"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="mood_checkins")
    score = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.HOME)
    checked_in_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-checked_in_at"]

    def __str__(self):
        return f"{self.student.alias}: {self.score}/10"


class JournalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="journal_entries")
    body = models.TextField(help_text="Encrypted at rest")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Journal entries"

    def __str__(self):
        return f"Journal {self.id}"


class Goal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="goals")
    title = models.CharField(max_length=200)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    done_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title


class SelfCareItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=100)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.label


class SelfCareLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="self_care_logs")
    item = models.ForeignKey(SelfCareItem, on_delete=models.CASCADE, related_name="logs")
    log_date = models.DateField(default=timezone.now)
    done = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "item", "log_date"], name="unique_self_care_per_day")
        ]

    def __str__(self):
        return f"{self.student.alias} - {self.item.label}"


class BreathingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="breathing_sessions")
    pattern = models.CharField(max_length=50)
    cycles_completed = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    started_at = models.DateTimeField(default=timezone.now)
    duration_seconds = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.student.alias} - {self.pattern}"