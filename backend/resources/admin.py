from django.contrib import admin
from .models import ResourceCategory, Resource, ResourceShare, SavedResource, AwarenessDay, Announcement

admin.site.register(ResourceCategory)
admin.site.register(Resource)
admin.site.register(ResourceShare)
admin.site.register(SavedResource)
admin.site.register(AwarenessDay)
admin.site.register(Announcement)