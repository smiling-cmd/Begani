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


class TuaHistoryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="memory@example.com", password="test-password",
            role=User.Role.STUDENT, is_active=True,
        )
        self.student = StudentProfile.objects.create(user=self.user, alias="memory")
        other = User.objects.create_user(
            email="other@example.com", password="test-password",
            role=User.Role.STUDENT, is_active=True,
        )
        self.other_student = StudentProfile.objects.create(user=other, alias="other")
        self.client.force_authenticate(user=self.user)
        therapist_user = User.objects.create_user(
            email="t@example.com", password="test-password",
            role=User.Role.THERAPIST, is_active=True,
        )
        self.therapist = TherapistProfile.objects.create(
            user=therapist_user, type=TherapistProfile.Type.SCHOOL,
            category=TherapistProfile.Category.COUNSELLOR, display_name="Remembered counsellor",
            format=TherapistProfile.Format.ONLINE, status=TherapistProfile.Status.APPROVED,
        )

    @staticmethod
    def reply(**fields):
        payload = {"reply": "I'm here.", "therapist_id": None, "crisis_detected": False, **fields}
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])

    def test_empty_history_for_new_student(self):
        response = self.client.get("/api/tua/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"conversation_id": None, "messages": []})

    def test_requires_login_and_student_profile(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/tua/history/").status_code, 401)
        admin = User.objects.create_user(email="a@example.com", password="x", role=User.Role.ADMIN, is_active=True)
        self.client.force_authenticate(user=admin)
        self.assertEqual(self.client.get("/api/tua/history/").status_code, 400)

    @patch("tua.services._get_client")
    def test_chat_is_restored_in_order_and_reused(self, get_client):
        create = get_client.return_value.chat.completions.create
        create.return_value = self.reply(reply="First reply")
        first = self.client.post("/api/tua/chat/", {"message": "I can't sleep"}, format="json")
        create.return_value = self.reply(reply="Second reply")
        second = self.client.post("/api/tua/chat/", {"message": "Still awake"}, format="json")

        self.assertEqual(first.data["conversation_id"], second.data["conversation_id"])
        history = self.client.get("/api/tua/history/").data
        self.assertEqual(history["conversation_id"], first.data["conversation_id"])
        self.assertEqual(
            [(m["role"], m["text"]) for m in history["messages"]],
            [("user", "I can't sleep"), ("tua", "First reply"), ("user", "Still awake"), ("tua", "Second reply")],
        )

    @patch("tua.services._get_client")
    def test_restored_reply_keeps_therapist_and_crisis_flag(self, get_client):
        create = get_client.return_value.chat.completions.create
        create.return_value = self.reply(reply="Try Remembered counsellor", therapist_id=str(self.therapist.id))
        self.client.post("/api/tua/chat/", {"message": "I need someone to talk to"}, format="json")
        create.return_value = self.reply(reply="Please get help now", crisis_detected=True)
        self.client.post("/api/tua/chat/", {"message": "I want to hurt myself"}, format="json")

        messages = self.client.get("/api/tua/history/").data["messages"]
        tua_replies = [m for m in messages if m["role"] == "tua"]
        self.assertEqual(tua_replies[0]["therapist_id"], str(self.therapist.id))
        self.assertFalse(tua_replies[0]["crisis_detected"])
        self.assertTrue(tua_replies[1]["crisis_detected"])
        self.assertFalse([m for m in messages if m["role"] == "user" and m["crisis_detected"]])

    def test_only_own_conversation_is_returned(self):
        from tua.models import TuaConversation
        theirs = TuaConversation.objects.create(student=self.other_student, title="x")
        TuaMessage.objects.create(conversation=theirs, role=TuaMessage.Role.STUDENT, content="private")
        response = self.client.get("/api/tua/history/")
        self.assertEqual(response.data["messages"], [])

    def test_deleted_conversation_is_not_restored(self):
        from django.utils import timezone
        from tua.models import TuaConversation
        old = TuaConversation.objects.create(student=self.student, title="old", deleted_at=timezone.now())
        TuaMessage.objects.create(conversation=old, role=TuaMessage.Role.STUDENT, content="gone")
        self.assertEqual(self.client.get("/api/tua/history/").data["messages"], [])


class TuaNewChatTests(APITestCase):
    def setUp(self):
        user = User.objects.create_user(
            email="newchat@example.com", password="test-password", role=User.Role.STUDENT, is_active=True
        )
        self.profile = StudentProfile.objects.create(user=user, alias="newchat")
        self.client.force_authenticate(user=user)

    def test_new_chat_starts_fresh_and_keeps_the_old_one(self):
        from tua.models import TuaConversation

        old = TuaConversation.objects.create(student=self.profile, title="old")
        TuaMessage.objects.create(conversation=old, role="student", content="hello")
        response = self.client.post("/api/tua/new/")
        self.assertEqual(response.status_code, 201)
        self.assertNotEqual(response.data["conversation_id"], str(old.id))
        self.assertTrue(TuaConversation.objects.filter(id=old.id, deleted_at__isnull=True).exists())
        history = self.client.get("/api/tua/history/")
        self.assertEqual(history.data["messages"], [])

    def test_new_chat_reuses_an_empty_conversation(self):
        first = self.client.post("/api/tua/new/").data["conversation_id"]
        second = self.client.post("/api/tua/new/").data["conversation_id"]
        self.assertEqual(first, second)


class TuaPastChatsTests(APITestCase):
    def setUp(self):
        from tua.models import TuaConversation

        self.TuaConversation = TuaConversation
        user = User.objects.create_user(email="past@example.com", password="x-test-pass", role=User.Role.STUDENT, is_active=True)
        self.profile = StudentProfile.objects.create(user=user, alias="past")
        other = User.objects.create_user(email="other@example.com", password="x-test-pass", role=User.Role.STUDENT, is_active=True)
        self.other_profile = StudentProfile.objects.create(user=other, alias="other")
        self.client.force_authenticate(user=user)
        self.old = TuaConversation.objects.create(student=self.profile, title="Exam stress")
        TuaMessage.objects.create(conversation=self.old, role="student", content="exams worry me")
        TuaMessage.objects.create(conversation=self.old, role="tua", content="Tell me more")
        self.theirs = TuaConversation.objects.create(student=self.other_profile, title="private")
        TuaMessage.objects.create(conversation=self.theirs, role="student", content="secret")

    def test_list_shows_only_own_non_empty_chats(self):
        self.TuaConversation.objects.create(student=self.profile, title="New chat")  # empty
        data = self.client.get("/api/tua/conversations/").data["conversations"]
        self.assertEqual([c["id"] for c in data], [str(self.old.id)])
        self.assertEqual(data[0]["title"], "Exam stress")
        self.assertFalse(data[0]["saved"])
        self.assertIn(data[0]["days_left"], (89, 90))

    def test_open_an_old_chat_by_id(self):
        response = self.client.get(f"/api/tua/history/?conversation_id={self.old.id}")
        self.assertEqual([m["text"] for m in response.data["messages"]], ["exams worry me", "Tell me more"])

    def test_cannot_open_or_save_someone_elses_chat(self):
        self.assertEqual(self.client.get(f"/api/tua/history/?conversation_id={self.theirs.id}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/tua/conversations/{self.theirs.id}/", {"saved": True}, format="json").status_code, 404)
        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.saved)

    def test_save_toggle(self):
        response = self.client.patch(f"/api/tua/conversations/{self.old.id}/", {"saved": True}, format="json")
        self.assertEqual(response.data["saved"], True)
        data = self.client.get("/api/tua/conversations/").data["conversations"]
        self.assertTrue(data[0]["saved"])
        self.assertIsNone(data[0]["days_left"])
        self.assertEqual(self.client.patch(f"/api/tua/conversations/{self.old.id}/", {"saved": "yes"}, format="json").status_code, 400)

    @patch("tua.views.get_tua_response")
    def test_chat_continues_a_chosen_conversation(self, mock_response):
        mock_response.return_value = {"reply": "I hear you", "therapist_id": None, "crisis_detected": False}
        newer = self.TuaConversation.objects.create(student=self.profile, title="newer")
        TuaMessage.objects.create(conversation=newer, role="student", content="hi")
        response = self.client.post("/api/tua/chat/", {"message": "back again", "conversation_id": str(self.old.id)}, format="json")
        self.assertEqual(response.data["conversation_id"], str(self.old.id))
        self.assertEqual(self.old.messages.count(), 4)
        self.assertEqual(newer.messages.count(), 1)
