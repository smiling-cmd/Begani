from django.urls import path

from .views import AdminResourceCreateView, ResourceListView

urlpatterns = [
    path("", ResourceListView.as_view(), name="resource-list"),
    path("admin/create/", AdminResourceCreateView.as_view(), name="admin-resource-create"),
]
