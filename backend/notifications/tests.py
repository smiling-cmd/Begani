import json
from typing import cast

from django.http import HttpResponse
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from .models import Notification


class NotificationApiTests(APITestCase):
    api_client: APIClient

    def setUp(self):
        self.user = User.objects.create_user(
            email="student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def get_response(self, path):
        return cast(HttpResponse, self.api_client.get(path))

    def patch_response(self, path):
        return cast(HttpResponse, self.api_client.patch(path, {}, format="json"))

    def test_list_only_returns_notifications_for_the_authenticated_user(self):
        own_notification = Notification.objects.create(
            user=self.user,
            type="new_message",
            body="You have a new message.",
        )
        Notification.objects.create(
            user=self.other_user,
            type="new_message",
            body="You have a new message.",
        )

        response = self.get_response("/api/notifications/")

        self.assertEqual(response.status_code, 200)
        notifications = json.loads(response.content)
        self.assertEqual([item["id"] for item in notifications], [str(own_notification.id)])

    def test_mark_read_is_idempotent_and_cannot_access_another_users_notification(self):
        own_notification = Notification.objects.create(
            user=self.user,
            type="new_message",
            body="You have a new message.",
        )
        other_notification = Notification.objects.create(
            user=self.other_user,
            type="new_message",
            body="You have a new message.",
        )

        first = self.patch_response(f"/api/notifications/{own_notification.id}/read/")
        own_notification.refresh_from_db()
        first_read_at = own_notification.read_at
        second = self.patch_response(f"/api/notifications/{own_notification.id}/read/")
        other = self.patch_response(f"/api/notifications/{other_notification.id}/read/")

        self.assertEqual(first.status_code, 200)
        self.assertIsNotNone(first_read_at)
        self.assertEqual(own_notification.read_at, first_read_at)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(other.status_code, 404)
        other_notification.refresh_from_db()
        self.assertIsNone(other_notification.read_at)
