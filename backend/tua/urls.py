from django.urls import path
from .views import AcceptPriorityRequestView, CreatePriorityRequestView, TherapistPriorityRequestListView, TuaChatView

urlpatterns = [
    path('chat/', TuaChatView.as_view(), name='tua-chat'),
    path('priority/', CreatePriorityRequestView.as_view(), name='priority-request'),
    path('priority/assigned/', TherapistPriorityRequestListView.as_view(), name='assigned-priority-requests'),
    path('priority/<uuid:request_id>/accept/', AcceptPriorityRequestView.as_view(), name='accept-priority-request'),
]
