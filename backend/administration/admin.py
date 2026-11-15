from django.contrib import admin
from .models import AdminPermission, DataRequest, AuditLog

admin.site.register(AdminPermission)
admin.site.register(DataRequest)
admin.site.register(AuditLog)