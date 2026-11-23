from django.urls import path
from .views import (
    AdminResourceCreateView,
    AdminResourcePublishView,
    AdminResourceDetailView,
    AdminResourceListView,
    ResourceListView,
)

urlpatterns = [
    # Student endpoint
    path("", ResourceListView.as_view(), name="resource-list"),
    
    # Admin endpoints
    path("admin/", AdminResourceListView.as_view(), name="admin-resource-list"),
    path("admin/create/", AdminResourceCreateView.as_view(), name="admin-resource-create"),
    path("admin/<uuid:pk>/", AdminResourceDetailView.as_view(), name="admin-resource-detail"),
    path("admin/<uuid:pk>/publish/", AdminResourcePublishView.as_view(), name="admin-resource-publish"),
]