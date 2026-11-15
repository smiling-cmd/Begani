from django.contrib import admin
from .models import MoodCheckin, JournalEntry, Goal, SelfCareItem, SelfCareLog, BreathingSession

admin.site.register(MoodCheckin)
admin.site.register(JournalEntry)
admin.site.register(Goal)
admin.site.register(SelfCareItem)
admin.site.register(SelfCareLog)
admin.site.register(BreathingSession)
