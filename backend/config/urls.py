from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/', include('accounts.urls')),

    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),

    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/wellbeing/', include('wellbeing.urls')),

    path('api/tua/', include('tua.urls')),
    
    path('api/counsellors/', include('counsellors.urls')),

    path('api/bookings/', include('bookings.urls')),

    path('api/resources/', include('resources.urls')),

    path('api/activities/', include('activities.urls')),
    
    path('api/messaging/', include('messaging.urls')),

    path('api/notifications/', include('notifications.urls')),
]
