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
