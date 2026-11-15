from django.contrib import admin
from .models import Activity, ActivityRegistration, FreePass

admin.site.register(Activity)
admin.site.register(ActivityRegistration)
admin.site.register(FreePass)