from django.urls import path
from .views import RegisterView, UserProfileView, UserProfileUpdateView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('me/update/', UserProfileUpdateView.as_view(), name='user_profile_update'),
]