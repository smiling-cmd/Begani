import json
from typing import cast

from django.http import HttpResponse
from rest_framework.test import APIClient, APITestCase

from .models import StudentProfile, User


class RegistrationSignInTests(APITestCase):
    def setUp(self):
        self.client = APIClient()

    def test_public_registration_creates_student_accounts_only(self):
        password = "test-password"
        registration = cast(
            HttpResponse,
            self.client.post(
                "/api/auth/register/",
                {
                    "email": "new-student@jkuat.ac.ke",
                    "password": password,
                    "phone": "0712345678",
                    "role": User.Role.THERAPIST,
                },
                format="json",
            ),
        )
        self.assertEqual(registration.status_code, 201)

        token_response = cast(
            HttpResponse,
            self.client.post(
                "/api/token/",
                {"email": "new-student@jkuat.ac.ke", "password": password},
                format="json",
            ),
        )
        self.assertEqual(token_response.status_code, 200)
        access_token = json.loads(token_response.content)["access"]

        profile_response = cast(
            HttpResponse,
            self.client.get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {access_token}",
            ),
        )
        self.assertEqual(profile_response.status_code, 200)
        profile = json.loads(profile_response.content)
        # A role supplied by the public sign-up form must be ignored.
        self.assertEqual(profile["role"], User.Role.STUDENT)
        self.assertEqual(profile["full_name"], "")

        rejected = cast(
            HttpResponse,
            self.client.post(
                "/api/auth/register/",
                {"email": "new-therapist@example.com", "password": password},
                format="json",
            ),
        )
        self.assertEqual(rejected.status_code, 400)


class UserProfileUpdateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="therapist@example.com",
            password="test-password",
            role="therapist",
            phone="0711111111",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_updates_phone_without_changing_read_only_fields(self):
        response = self.client.patch(
            "/api/auth/me/update/",
            {"phone": "0722222222", "email": "changed@example.com", "role": "admin"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "0722222222")
        self.assertEqual(self.user.email, "therapist@example.com")
        self.assertEqual(self.user.role, "therapist")

    def test_updates_full_name_and_returns_trimmed_value(self):
        response = cast(
            HttpResponse,
            self.client.patch(
                "/api/auth/me/update/",
                {"full_name": "  Amina Njoroge  "},
                format="json",
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Amina Njoroge")
        self.assertEqual(json.loads(response.content)["full_name"], "Amina Njoroge")

    def test_non_students_cannot_set_a_public_alias(self):
        response = self.client.patch(
            "/api/auth/me/update/",
            {"alias": "counsellor"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("alias", response.data)

    def test_rejects_blank_full_name(self):
        response = cast(
            HttpResponse,
            self.client.patch(
                "/api/auth/me/update/",
                {"full_name": "   "},
                format="json",
            ),
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "")

    def test_profile_includes_absolute_student_photo_url_when_available(self):
        student = User.objects.create_user(
            email="photo-student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
        )
        StudentProfile.objects.create(
            user=student,
            alias="PhotoStudent",
            photo="student_photos/profile.jpg",
        )
        self.client.force_authenticate(user=student)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["photo"],
            "http://testserver/media/student_photos/profile.jpg",
        )

    def test_student_can_set_a_distinct_public_alias(self):
        student = User.objects.create_user(
            email="student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
        )
        profile = StudentProfile.objects.create(user=student, alias="Student_123abc")
        self.client.force_authenticate(user=student)

        response = cast(
            HttpResponse,
            self.client.patch(
                "/api/auth/me/update/",
                {"full_name": "Amina Njoroge", "alias": "  Amina.N  "},
                format="json",
            ),
        )

        self.assertEqual(response.status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(profile.alias, "Amina.N")
        self.assertEqual(json.loads(response.content)["alias"], "Amina.N")

    def test_rejects_aliases_used_by_another_student_case_insensitively(self):
        student = User.objects.create_user(
            email="student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
        )
        profile = StudentProfile.objects.create(user=student, alias="Student_123abc")
        other_student = User.objects.create_user(
            email="other-student@example.com",
            password="test-password",
            role=User.Role.STUDENT,
        )
        StudentProfile.objects.create(user=other_student, alias="Yvonne")
        self.client.force_authenticate(user=student)

        response = cast(
            HttpResponse,
            self.client.patch(
                "/api/auth/me/update/",
                {"alias": "yvonne"},
                format="json",
            ),
        )

        self.assertEqual(response.status_code, 400)
        profile.refresh_from_db()
        self.assertEqual(profile.alias, "Student_123abc")


from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import override_settings

from .google_auth import GoogleAuthError


@override_settings(FRONTEND_URL="https://app.begani.test", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordResetTests(APITestCase):
    def setUp(self):
        cache.clear()  # rate limits are kept in the cache
        self.user = User.objects.create_user(
            email="reset@jkuat.ac.ke", password="old-password-123", role=User.Role.STUDENT,
            full_name="Reset Student", is_active=True,
        )

    def request_link(self, email="reset@jkuat.ac.ke"):
        response = self.client.post("/api/auth/password-reset/", {"email": email}, format="json")
        self.assertEqual(response.status_code, 200)
        return response

    def link_parts(self):
        import re
        match = re.search(r"/reset-password/([^/\s]+)/([^/\s]+)", mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1), match.group(2)

    def test_known_and_unknown_emails_get_the_same_reply(self):
        known = self.request_link()
        unknown = self.request_link("nobody@jkuat.ac.ke")
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)  # only the real account was emailed

    def test_email_contains_a_link_to_the_frontend(self):
        self.request_link()
        self.assertEqual(mail.outbox[0].to, ["reset@jkuat.ac.ke"])
        self.assertIn("https://app.begani.test/reset-password/", mail.outbox[0].body)

    def test_requires_an_email(self):
        self.assertEqual(self.client.post("/api/auth/password-reset/", {}, format="json").status_code, 400)

    def test_inactive_accounts_are_not_emailed(self):
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.request_link()
        self.assertEqual(len(mail.outbox), 0)

    def test_link_sets_a_new_password_and_works_only_once(self):
        self.request_link()
        uid, token = self.link_parts()
        done = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "brand-new-pass-456"}, format="json")
        self.assertEqual(done.status_code, 200)
        self.assertEqual(self.client.post("/api/token/", {"email": "reset@jkuat.ac.ke", "password": "brand-new-pass-456"}, format="json").status_code, 200)
        self.assertEqual(self.client.post("/api/token/", {"email": "reset@jkuat.ac.ke", "password": "old-password-123"}, format="json").status_code, 401)
        again = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "another-pass-789"}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_rejects_weak_passwords_and_keeps_the_link_usable(self):
        self.request_link()
        uid, token = self.link_parts()
        weak = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "123"}, format="json")
        self.assertEqual(weak.status_code, 400)
        self.assertIn("password", weak.data)
        ok = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "a-strong-pass-321"}, format="json")
        self.assertEqual(ok.status_code, 200)

    def test_rejects_tampered_links(self):
        self.request_link()
        uid, token = self.link_parts()
        for payload in (
            {"uid": uid, "token": token[:-2] + "xx", "password": "a-strong-pass-321"},
            {"uid": "bad", "token": token, "password": "a-strong-pass-321"},
            {"uid": "", "token": "", "password": "a-strong-pass-321"},
        ):
            self.assertEqual(self.client.post("/api/auth/password-reset/confirm/", payload, format="json").status_code, 400)

    @override_settings(PASSWORD_RESET_TIMEOUT=-1)
    def test_expired_links_are_rejected(self):
        self.request_link()
        uid, token = self.link_parts()
        self.assertEqual(self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "a-strong-pass-321"}, format="json").status_code, 400)


@override_settings(GOOGLE_CLIENT_ID="test-client-id.apps.googleusercontent.com")
class GoogleLoginTests(APITestCase):
    URL = "/api/auth/google/"

    def setUp(self):
        cache.clear()

    def sign_in(self, info=None, error=None):
        target = "accounts.views.verify_google_credential"
        with patch(target, side_effect=error) if error else patch(target, return_value=info):
            return self.client.post(self.URL, {"credential": "fake-token"}, format="json")

    def test_new_university_email_creates_a_student_and_returns_tokens(self):
        response = self.sign_in({"email": "New.Person@jkuat.ac.ke", "email_verified": True, "name": "New Person"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])
        user = User.objects.get(email="new.person@jkuat.ac.ke")
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertEqual(user.full_name, "New Person")
        self.assertFalse(user.has_usable_password())
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())
        me = self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(me.status_code, 200)

    def test_existing_account_signs_in_without_creating_another(self):
        User.objects.create_user(email="old@jkuat.ac.ke", password="x-password-1", role=User.Role.STUDENT, is_active=True)
        response = self.sign_in({"email": "old@jkuat.ac.ke", "email_verified": True, "name": "Old"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["created"])
        self.assertEqual(User.objects.filter(email="old@jkuat.ac.ke").count(), 1)

    def test_existing_therapist_keeps_their_role(self):
        User.objects.create_user(email="doc@example.com", password="x-password-1", role=User.Role.THERAPIST, is_active=True)
        response = self.sign_in({"email": "doc@example.com", "email_verified": True})
        self.assertEqual(response.status_code, 200)
        me = self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(me.data["role"], User.Role.THERAPIST)

    def test_new_non_university_email_cannot_sign_up(self):
        response = self.sign_in({"email": "someone@gmail.com", "email_verified": True})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="someone@gmail.com").exists())

    def test_unverified_google_email_is_rejected(self):
        self.assertEqual(self.sign_in({"email": "a@jkuat.ac.ke", "email_verified": False}).status_code, 400)

    def test_inactive_account_is_refused(self):
        User.objects.create_user(email="off@jkuat.ac.ke", password="x-password-1", role=User.Role.STUDENT, is_active=False)
        self.assertEqual(self.sign_in({"email": "off@jkuat.ac.ke", "email_verified": True}).status_code, 403)

    def test_invalid_google_token_is_rejected(self):
        self.assertEqual(self.sign_in(error=GoogleAuthError("bad")).status_code, 401)

    def test_missing_credential_is_rejected(self):
        self.assertEqual(self.client.post(self.URL, {}, format="json").status_code, 400)

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_reports_when_google_is_not_configured(self):
        self.assertEqual(self.client.post(self.URL, {"credential": "x"}, format="json").status_code, 503)

    def test_verifier_turns_bad_tokens_into_401(self):
        # The real verifier wrapper runs; only Google's library call is replaced.
        with patch("accounts.google_auth.id_token.verify_oauth2_token", side_effect=ValueError("Wrong number of segments")):
            response = self.client.post(self.URL, {"credential": "not.a.jwt"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_verifier_rejects_tokens_from_another_issuer(self):
        with patch("accounts.google_auth.id_token.verify_oauth2_token", return_value={"iss": "evil.example.com", "email": "a@jkuat.ac.ke", "email_verified": True}):
            response = self.client.post(self.URL, {"credential": "x.y.z"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_google_being_unreachable_is_a_503_not_a_crash(self):
        from google.auth.exceptions import TransportError
        with patch("accounts.google_auth.id_token.verify_oauth2_token", side_effect=TransportError("offline")):
            response = self.client.post(self.URL, {"credential": "x.y.z"}, format="json")
        self.assertEqual(response.status_code, 503)
