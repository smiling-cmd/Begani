from django.urls import path
from .views import (
    GoogleLoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    UserProfileUpdateView,
    UserProfileView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('google/', GoogleLoginView.as_view(), name='google_login'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('me/update/', UserProfileUpdateView.as_view(), name='user_profile_update'),
]