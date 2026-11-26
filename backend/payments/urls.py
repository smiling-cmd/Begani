from django.urls import path

from .views import (
    BookingPayView,
    PaymentStatusView,
    PayoutAccountView,
    PaystackWebhookView,
    RegistrationPayView,
    TherapistEarningsView,
)

urlpatterns = [
    path("earnings/", TherapistEarningsView.as_view(), name="therapist-earnings"),
    path("booking/<uuid:pk>/pay/", BookingPayView.as_view(), name="booking-pay"),
    path("registration/<uuid:pk>/pay/", RegistrationPayView.as_view(), name="registration-pay"),
    path("payout-account/", PayoutAccountView.as_view(), name="payout-account"),
    path("webhook/", PaystackWebhookView.as_view(), name="paystack-webhook"),
    path("<uuid:pk>/", PaymentStatusView.as_view(), name="payment-status"),
]
