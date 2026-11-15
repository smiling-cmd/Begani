from django.contrib import admin
from .models import TuaConversation, TuaMessage, TuaRecommendation, SafetyEvent, PriorityRequest

admin.site.register(TuaConversation)
admin.site.register(TuaMessage)
admin.site.register(TuaRecommendation)
admin.site.register(SafetyEvent)
admin.site.register(PriorityRequest)
