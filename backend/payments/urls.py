from django.urls import path

from .views import TherapistEarningsView

urlpatterns = [
    path("earnings/", TherapistEarningsView.as_view(), name="therapist-earnings"),
]
