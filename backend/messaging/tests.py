import json
from typing import cast

from django.http import HttpResponse
from rest_framework.test import APIClient, APITestCase

from accounts.models import StudentProfile, User
from counsellors.models import TherapistProfile
from notifications.models import Notification
from .models import ChatMessage, ChatThread


class MessagingApiTests(APITestCase):
    api_client: APIClient

    def setUp(self):
        self.student_user = User.objects.create_user(
            email="student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        self.student = StudentProfile.objects.create(user=self.student_user, alias="student-alias")
        self.therapist_user = User.objects.create_user(
            email="therapist@example.com",
            password="test-password",
            role=User.Role.THERAPIST,
            is_active=True,
        )
        self.therapist = TherapistProfile.objects.create(
            user=self.therapist_user,
            type=TherapistProfile.Type.PRIVATE,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name="Dr. Amara",
            format=TherapistProfile.Format.ONLINE,
            fee_kes=500,
            status=TherapistProfile.Status.APPROVED,
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        self.other_student = StudentProfile.objects.create(user=self.other_user, alias="other-alias")
        self.api_client = APIClient()

    def post_json(self, path, payload):
        response = self.api_client.post(path, payload, format="json")
        return cast(HttpResponse, response)

    def get_response(self, path):
        return cast(HttpResponse, self.api_client.get(path))

    def test_start_chat_is_idempotent_for_student_and_approved_therapist(self):
        self.api_client.force_authenticate(user=self.student_user)
        first = self.post_json(
            "/api/messaging/start/",
            {"therapist_id": str(self.therapist.id)},
        )
        second = self.post_json(
            "/api/messaging/start/",
            {"therapist_id": str(self.therapist.id)},
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(json.loads(first.content)["thread_id"], json.loads(second.content)["thread_id"])
        self.assertEqual(ChatThread.objects.count(), 1)
        self.assertEqual(ChatThread.objects.get().intro_limit, 10)

    def test_messages_persist_and_only_thread_participants_can_read_or_send(self):
        thread = ChatThread.objects.create(
            student=self.student,
            therapist=self.therapist,
            intro_limit=None,
        )
        self.api_client.force_authenticate(user=self.student_user)
        sent = self.post_json(
            f"/api/messaging/{thread.id}/send/",
            {"body": "Hello, I would like to talk."},
        )

        self.assertEqual(sent.status_code, 201)
        self.assertEqual(ChatMessage.objects.get(thread=thread).body, "Hello, I would like to talk.")
        notification = Notification.objects.get(user=self.therapist_user)
        self.assertEqual(notification.type, "new_message")
        self.assertNotIn("Hello, I would like to talk.", notification.body)

        self.api_client.force_authenticate(user=self.therapist_user)
        detail = self.get_response(f"/api/messaging/{thread.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(json.loads(detail.content)["messages"][0]["body"], "Hello, I would like to talk.")
        reply = self.post_json(
            f"/api/messaging/{thread.id}/send/",
            {"body": "Thanks for reaching out."},
        )
        self.assertEqual(reply.status_code, 201)
        student_notification = Notification.objects.get(user=self.student_user)
        self.assertEqual(student_notification.type, "new_message")
        self.assertNotIn("Thanks for reaching out.", student_notification.body)

        self.api_client.force_authenticate(user=self.other_user)
        self.assertEqual(self.get_response(f"/api/messaging/{thread.id}/").status_code, 404)
        self.assertEqual(
            self.post_json(
                f"/api/messaging/{thread.id}/send/",
                {"body": "This should not be delivered."},
            ).status_code,
            404,
        )
        self.assertEqual(ChatMessage.objects.filter(thread=thread).count(), 2)

    def test_private_chat_intro_limit_blocks_additional_messages(self):
        thread = ChatThread.objects.create(
            student=self.student,
            therapist=self.therapist,
            intro_limit=1,
        )
        self.api_client.force_authenticate(user=self.student_user)

        first = self.post_json(
            f"/api/messaging/{thread.id}/send/",
            {"body": "First message"},
        )
        second = self.post_json(
            f"/api/messaging/{thread.id}/send/",
            {"body": "Second message"},
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 403)
        self.assertEqual(ChatMessage.objects.filter(thread=thread).count(), 1)
