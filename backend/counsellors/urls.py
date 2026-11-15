from django.urls import path
from .views import TherapistListView, TherapistDetailView, TherapistAvailabilityView

urlpatterns = [
    path('', TherapistListView.as_view(), name='therapist-list'),
    path('availability/', TherapistAvailabilityView.as_view(), name='therapist-availability'),
    path('availability/create/', TherapistAvailabilityView.as_view(), name='create-slot'),
    path('<uuid:pk>/', TherapistDetailView.as_view(), name='therapist-detail'),
]
