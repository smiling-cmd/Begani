import json
from typing import cast

from django.http import HttpResponse
from rest_framework.test import APIClient, APITestCase

from .models import User


class RegistrationSignInTests(APITestCase):
    def setUp(self):
        self.client = APIClient()

    def test_student_and_therapist_can_sign_in_and_fetch_their_profiles(self):
        accounts = (
            ("new-student@jkuat.ac.ke", User.Role.STUDENT),
            ("new-therapist@example.com", User.Role.THERAPIST),
        )
        for email, role in accounts:
            with self.subTest(role=role):
                password = "test-password"
                registration = cast(
                    HttpResponse,
                    self.client.post(
                        "/api/auth/register/",
                        {"email": email, "password": password, "phone": "0712345678", "role": role},
                        format="json",
                    ),
                )
                self.assertEqual(registration.status_code, 201)

                token_response = cast(
                    HttpResponse,
                    self.client.post(
                        "/api/token/",
                        {"email": email, "password": password},
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
                self.assertEqual(profile["role"], role)
                self.assertEqual(profile["full_name"], "")


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
