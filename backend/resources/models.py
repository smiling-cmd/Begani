import re
import uuid
from django.db import models
from django.utils import timezone
from django.utils.html import strip_tags


def calculate_reading_time(body):
    """Approximate reading time in minutes, ~200 words per minute."""
    if not body:
        return 0
    plain = strip_tags(body)
    word_count = len(re.findall(r'\S+', plain))
    if word_count == 0:
        return 0
    return max(1, round(word_count / 200))


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
        PENDING_REVIEW = "pending_review", "Pending review"
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

    # Editorial fields
    cover_image = models.ImageField(upload_to="resources/covers/", blank=True, null=True)
    image_alt = models.CharField(max_length=200, blank=True)
    reading_time = models.PositiveIntegerField(default=0)
    author_display = models.CharField(max_length=100, default="BEGANI Editorial Team")

    # NEW: File upload fields for media
    video_file = models.FileField(upload_to="resources/videos/", blank=True, null=True)
    audio_file = models.FileField(upload_to="resources/audio/", blank=True, null=True)

    # Review / publishing metadata
    reviewed_by = models.CharField(max_length=200, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)

    def save(self, *args, **kwargs):
        self.reading_time = calculate_reading_time(self.body)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ResourceReference(models.Model):
    """A single APA 7 reference attached to a Resource."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="references")
    author = models.CharField(max_length=200)
    year = models.PositiveIntegerField()
    title = models.CharField(max_length=300)
    publication = models.CharField(max_length=300, blank=True)
    url = models.URLField(blank=True)
    doi = models.CharField(max_length=100, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "author"]

    def __str__(self):
        return f"{self.author} ({self.year})"


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