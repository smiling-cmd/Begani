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


class AdminResourceCreateTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email="content-admin@example.com",
            password="test-password",
            role="admin",
            is_active=True,
            is_staff=False,
        )
        self.student = user_model.objects.create_user(
            email="content-student@example.ac.ke",
            password="test-password",
            role="student",
            is_active=True,
        )

    def test_admin_can_create_published_resource_and_category(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/resources/admin/create/",
            {
                "title": "Managing Exam Stress",
                "summary": "A practical guide",
                "body": "Take one step at a time.",
                "type": Resource.Type.ARTICLE,
                "category": "Exam Stress",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        resource = Resource.objects.get(id=response.data["id"])
        self.assertEqual(resource.status, Resource.Status.PUBLISHED)
        self.assertEqual(resource.created_by, self.admin)
        self.assertEqual(resource.category.name, "Exam Stress")
        self.assertEqual(response.data["category_name"], "Exam Stress")
        self.assertTrue(resource.published_at)

        self.client.force_authenticate(user=self.student)
        student_resources = self.client.get("/api/resources/")
        self.assertEqual(student_resources.status_code, 200)
        self.assertEqual(student_resources.data[0]["title"], "Managing Exam Stress")

    def test_non_admin_cannot_create_resources(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            "/api/resources/admin/create/",
            {
                "title": "Managing Exam Stress",
                "body": "Take one step at a time.",
                "type": Resource.Type.ARTICLE,
                "category": "Exam Stress",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Resource.objects.exists())
