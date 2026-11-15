import uuid
from django.db import models
from django.utils import timezone


class ResourceCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Resource categories"

    def __str__(self):
        return self.name


class Resource(models.Model):
    class Type(models.TextChoices):
        ARTICLE = "article", "Article"
        AUDIO = "audio", "Audio"
        VIDEO = "video", "Video"
        GUIDE = "guide", "Guide"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ResourceCategory, on_delete=models.PROTECT, related_name="resources")
    type = models.CharField(max_length=20, choices=Type.choices)
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    body = models.TextField(blank=True)
    media_url = models.URLField(blank=True)
    language = models.CharField(max_length=10, default="en")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    reviewed_by = models.CharField(max_length=200, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.title


class ResourceShare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE)
    class_group = models.ForeignKey("accounts.ClassGroup", on_delete=models.CASCADE)
    shared_by = models.ForeignKey("accounts.User", on_delete=models.CASCADE)
    message = models.CharField(max_length=255, blank=True)
    shared_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Shared {self.resource.title}"


class SavedResource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="saved_resources")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "resource"], name="unique_saved_resource")
        ]


class AwarenessDay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    date = models.DateField()
    description = models.TextField(blank=True)
    audience_note = models.TextField(blank=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.title


class Announcement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    body = models.TextField()
    awareness_day = models.ForeignKey(AwarenessDay, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title