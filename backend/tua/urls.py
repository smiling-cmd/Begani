from django.urls import path
from .views import TuaChatView

urlpatterns = [
    path('chat/', TuaChatView.as_view(), name='tua-chat'),
]