import uuid
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=50)
    body = models.CharField(max_length=255, help_text="No health details allowed")
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)
    sms_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification for {self.user.email}"