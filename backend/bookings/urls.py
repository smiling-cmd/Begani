from django.urls import path
from .views import BookingCreateView, StudentBookingListView, TherapistBookingListView, BookingStatusUpdateView

urlpatterns = [
    path('create/', BookingCreateView.as_view(), name='booking-create'),
    path('my/', StudentBookingListView.as_view(), name='student-booking-list'),
    path('therapist-list/', TherapistBookingListView.as_view(), name='therapist-booking-list'),
    path('<uuid:pk>/status/', BookingStatusUpdateView.as_view(), name='booking-status-update'),
]