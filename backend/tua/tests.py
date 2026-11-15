import json
from types import SimpleNamespace
from unittest.mock import patch

from rest_framework.test import APITestCase

from accounts.models import StudentProfile, User
from counsellors.models import TherapistProfile
from messaging.models import ChatThread
from notifications.models import Notification
from tua.models import PriorityRequest, TuaMessage


class TuaTherapistRecommendationTests(APITestCase):
    def setUp(self):
        student_user = User.objects.create_user(
            email="student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        StudentProfile.objects.create(user=student_user, alias="student")
        self.client.force_authenticate(user=student_user)
        self.approved_therapist = self.create_therapist(
            "approved@example.com",
            "Approved counsellor",
            TherapistProfile.Status.APPROVED,
        )
        self.pending_therapist = self.create_therapist(
            "pending@example.com",
            "Pending counsellor",
            TherapistProfile.Status.PENDING,
        )

    def create_therapist(self, email, display_name, status):
        user = User.objects.create_user(
            email=email,
            password="test-password",
            role=User.Role.THERAPIST,
            is_active=True,
        )
        return TherapistProfile.objects.create(
            user=user,
            type=TherapistProfile.Type.SCHOOL,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name=display_name,
            format=TherapistProfile.Format.ONLINE,
            status=status,
        )

    @staticmethod
    def model_response(content):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )

    @patch("tua.services._get_client")
    def test_returns_only_an_approved_therapist_id(self, get_client):
        create_completion = get_client.return_value.chat.completions.create
        create_completion.return_value = self.model_response(json.dumps({
            "reply": "I recommend Approved counsellor, who offers free sessions.",
            "therapist_id": str(self.approved_therapist.id),
        }))

        response = self.client.post(
            "/api/tua/chat/",
            {"message": "I would like to talk to a counsellor."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["therapist_id"], str(self.approved_therapist.id))
        self.assertEqual(response.data["reply"], "I recommend Approved counsellor, who offers free sessions.")
        prompt = create_completion.call_args.kwargs["messages"][0]["content"]
        self.assertIn(str(self.approved_therapist.id), prompt)
        self.assertNotIn(str(self.pending_therapist.id), prompt)
        self.assertEqual(
            create_completion.call_args.kwargs["response_format"],
            {"type": "json_object"},
        )
        self.assertEqual(
            TuaMessage.objects.filter(role=TuaMessage.Role.TUA).get().content,
            response.data["reply"],
        )

    @patch("tua.services._get_client")
    def test_discards_unapproved_therapist_ids(self, get_client):
        create_completion = get_client.return_value.chat.completions.create
        create_completion.return_value = self.model_response(json.dumps({
            "reply": "I recommend this counsellor.",
            "therapist_id": str(self.pending_therapist.id),
        }))

        response = self.client.post(
            "/api/tua/chat/",
            {"message": "Can you recommend a counsellor?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["therapist_id"])

    @patch("tua.services._get_client")
    def test_rejects_malformed_model_json(self, get_client):
        get_client.return_value.chat.completions.create.return_value = self.model_response("not JSON")

        with self.assertLogs("tua.views", level="ERROR"):
            response = self.client.post(
                "/api/tua/chat/",
                {"message": "I need support."},
                format="json",
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(TuaMessage.objects.filter(role=TuaMessage.Role.TUA).count(), 0)


class PriorityRequestDashboardTests(APITestCase):
    def setUp(self):
        self.student_user = User.objects.create_user(
            email="priority-student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )
        self.student = StudentProfile.objects.create(user=self.student_user, alias="priority-student")
        self.therapist_user = User.objects.create_user(
            email="priority-counsellor@example.com",
            password="test-password",
            role=User.Role.THERAPIST,
            is_active=True,
        )
        self.therapist = TherapistProfile.objects.create(
            user=self.therapist_user,
            type=TherapistProfile.Type.SCHOOL,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name="Priority counsellor",
            format=TherapistProfile.Format.ONLINE,
            status=TherapistProfile.Status.APPROVED,
        )

    def test_created_request_is_listed_for_assigned_counsellor(self):
        self.client.force_authenticate(user=self.student_user)
        create_response = self.client.post(
            "/api/tua/priority/",
            {"source": PriorityRequest.Source.FIND_SUPPORT, "phone_consent": False},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        priority_request = PriorityRequest.objects.get(id=create_response.data["id"])
        self.assertEqual(priority_request.student, self.student)
        self.assertEqual(priority_request.therapist, self.therapist)
        self.assertTrue(ChatThread.objects.filter(student=self.student, therapist=self.therapist).exists())
        self.assertTrue(Notification.objects.filter(user=self.therapist_user, type="priority_request").exists())

        self.client.force_authenticate(user=self.therapist_user)
        list_response = self.client.get("/api/tua/priority/assigned/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([item["id"] for item in list_response.data], [str(priority_request.id)])
