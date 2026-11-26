from .models import AuditLog


def log_admin_action(request, action, object_type, object_id):
    """Record who did what in the admin portal (shown in Django admin > Audit logs)."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None
    try:
        AuditLog.objects.create(actor=request.user, action=action, object_type=object_type, object_id=str(object_id), ip_address=ip)
    except Exception:  # an audit failure must never block the admin's action
        pass
