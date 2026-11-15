import uuid
from django.db import models
from django.utils import timezone


class AdminPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="admin_permissions")
    permission = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.user.email} - {self.permission}"


class DataRequest(models.Model):
    class Type(models.TextChoices):
        EXPORT = "export", "Export"
        DELETE = "delete", "Delete"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="data_requests")
    type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.type} request for {self.user.email}"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} by {self.actor}"