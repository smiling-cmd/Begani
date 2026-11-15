from django.urls import path

from .views import ChatDetailView, ChatThreadListView, SendMessageView, StartChatView

urlpatterns = [
    path("start/", StartChatView.as_view(), name="start-chat"),
    path("threads/", ChatThreadListView.as_view(), name="chat-thread-list"),
    path("<uuid:pk>/", ChatDetailView.as_view(), name="chat-detail"),
    path("<uuid:thread_id>/send/", SendMessageView.as_view(), name="send-message"),
]
