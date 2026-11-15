from django.urls import path
from .views import (
    BookingCreateView,
    BookingStatusUpdateView,
    StudentBookingListView,
    TherapistBookingListView,
    TherapistInsightsView,
)

urlpatterns = [
    path('create/', BookingCreateView.as_view(), name='booking-create'),
    path('my/', StudentBookingListView.as_view(), name='student-booking-list'),
    path('therapist-list/', TherapistBookingListView.as_view(), name='therapist-booking-list'),
    path('insights/', TherapistInsightsView.as_view(), name='therapist-insights'),
    path('<uuid:pk>/status/', BookingStatusUpdateView.as_view(), name='booking-status-update'),
]