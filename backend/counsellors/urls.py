from django.urls import path
from .views import (
    AdminTherapistApproveView,
    AdminTherapistListView,
    TherapistListView,
    TherapistDetailView,
    TherapistAvailabilityView,
)

urlpatterns = [
    path('', TherapistListView.as_view(), name='therapist-list'),
    path('availability/', TherapistAvailabilityView.as_view(), name='therapist-availability'),
    path('availability/create/', TherapistAvailabilityView.as_view(), name='create-slot'),
    path('admin/list/', AdminTherapistListView.as_view(), name='admin-therapist-list'),
    path('admin/<uuid:pk>/approve/', AdminTherapistApproveView.as_view(), name='admin-therapist-approve'),
    path('<uuid:pk>/', TherapistDetailView.as_view(), name='therapist-detail'),
]
