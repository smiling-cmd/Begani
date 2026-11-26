from django.urls import path

from .views import (
    AdminActivityCancelView,
    AdminActivityCreateView,
    AdminActivityDetailView,
    AdminActivityListView,
    ActivityListView,
    ActivityRegistrationCancelView,
    ActivityRegistrationCreateView,
    StudentActivityRegistrationListView,
)

urlpatterns = [
    path("", ActivityListView.as_view(), name="activity-list"),
    path("admin/", AdminActivityListView.as_view(), name="admin-activity-list"),
    path("admin/<uuid:pk>/", AdminActivityDetailView.as_view(), name="admin-activity-detail"),
    path("admin/<uuid:activity_id>/cancel/", AdminActivityCancelView.as_view(), name="admin-activity-cancel"),
    path("admin/create/", AdminActivityCreateView.as_view(), name="admin-activity-create"),
    path("registrations/", StudentActivityRegistrationListView.as_view(), name="my-activity-registrations"),
    path("registrations/<uuid:registration_id>/cancel/", ActivityRegistrationCancelView.as_view(), name="activity-registration-cancel"),
    path("<uuid:activity_id>/register/", ActivityRegistrationCreateView.as_view(), name="activity-register"),
]
