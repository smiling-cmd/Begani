from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class PasswordResetThrottle(AnonRateThrottle):
    """Limit how often one client can ask for, or try to use, a reset link."""

    scope = 'password_reset'


class GoogleLoginThrottle(AnonRateThrottle):
    scope = 'google_login'


class PaymentStartThrottle(UserRateThrottle):
    scope = 'payment_start'
