from django.urls import path
from .views import MoodCheckinListCreateView, JournalEntryListCreateView

urlpatterns = [
    path('moods/', MoodCheckinListCreateView.as_view(), name='mood-list-create'),
    path('journals/', JournalEntryListCreateView.as_view(), name='journal-list-create'),
]