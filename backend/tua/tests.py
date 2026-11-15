import json
from types import SimpleNamespace
from unittest.mock import patch

from rest_framework.test import APITestCase

from accounts.models import StudentProfile, User
from counsellors.models import TherapistProfile
from tua.models import TuaMessage


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

    @patch("tua.services.client.chat.completions.create")
    def test_returns_only_an_approved_therapist_id(self, create_completion):
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

    @patch("tua.services.client.chat.completions.create")
    def test_discards_unapproved_therapist_ids(self, create_completion):
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

    @patch("tua.services.client.chat.completions.create")
    def test_rejects_malformed_model_json(self, create_completion):
        create_completion.return_value = self.model_response("not JSON")

        with self.assertLogs("tua.views", level="ERROR"):
            response = self.client.post(
                "/api/tua/chat/",
                {"message": "I need support."},
                format="json",
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(TuaMessage.objects.filter(role=TuaMessage.Role.TUA).count(), 0)
