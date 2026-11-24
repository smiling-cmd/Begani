from django.urls import path
from .views import (
    BookingCreateView,
    BookingStatusUpdateView,
    StudentAppointmentListView,
    StudentBookingCancelView,
    StudentBookingListView,
    TherapistBookingListView,
    TherapistInsightsView,
)

urlpatterns = [
    path('create/', BookingCreateView.as_view(), name='booking-create'),
    path('my/', StudentBookingListView.as_view(), name='student-booking-list'),
    path('appointments/', StudentAppointmentListView.as_view(), name='student-appointment-list'),
    path('<uuid:pk>/cancel/', StudentBookingCancelView.as_view(), name='student-booking-cancel'),
    path('therapist-list/', TherapistBookingListView.as_view(), name='therapist-booking-list'),
    path('insights/', TherapistInsightsView.as_view(), name='therapist-insights'),
    path('<uuid:pk>/status/', BookingStatusUpdateView.as_view(), name='booking-status-update'),
]