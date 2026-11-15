from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Resource, ResourceCategory


class ResourceListTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="student@example.ac.ke",
            password="test-password",
            role="student",
        )
        self.client.force_authenticate(user=self.user)
        self.category = ResourceCategory.objects.create(name="Wellbeing", slug="wellbeing")
        Resource.objects.create(
            category=self.category,
            type=Resource.Type.ARTICLE,
            title="Published guide",
            summary="A guide",
            body="Guide body",
            status=Resource.Status.PUBLISHED,
            created_by=self.user,
        )
        Resource.objects.create(
            category=self.category,
            type=Resource.Type.ARTICLE,
            title="Draft guide",
            status=Resource.Status.DRAFT,
            created_by=self.user,
        )

    def test_lists_published_resources_with_category(self):
        response = self.client.get("/api/resources/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Published guide")
        self.assertEqual(response.data[0]["category"], "Wellbeing")
        self.assertEqual(response.data[0]["body"], "Guide body")

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/resources/")

        self.assertEqual(response.status_code, 401)
