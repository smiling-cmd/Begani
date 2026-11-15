from django.urls import path
from .views import BookingCreateView, TherapistBookingListView, BookingStatusUpdateView

urlpatterns = [
    path('create/', BookingCreateView.as_view(), name='booking-create'),
    path('therapist-list/', TherapistBookingListView.as_view(), name='therapist-booking-list'),
    path('<uuid:pk>/status/', BookingStatusUpdateView.as_view(), name='booking-status-update'),
]