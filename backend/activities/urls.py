from django.urls import path

from .views import (
    AdminActivityCreateView,
    ActivityListView,
    ActivityRegistrationCreateView,
    StudentActivityRegistrationListView,
)

urlpatterns = [
    path("", ActivityListView.as_view(), name="activity-list"),
    path("admin/create/", AdminActivityCreateView.as_view(), name="admin-activity-create"),
    path("registrations/", StudentActivityRegistrationListView.as_view(), name="my-activity-registrations"),
    path("<uuid:activity_id>/register/", ActivityRegistrationCreateView.as_view(), name="activity-register"),
]
