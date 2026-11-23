from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Resource, ResourceCategory, ResourceReference


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


class AdminResourceTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email="admin@example.com", password="x-pass-123", role="admin")
        self.student = User.objects.create_user(email="s@example.ac.ke", password="x-pass-123", role="student")
        self.category = ResourceCategory.objects.create(name="Sleep", slug="sleep")
        self.resource = Resource.objects.create(
            category=self.category, type=Resource.Type.ARTICLE, title="Sleep well",
            body="word " * 450, status=Resource.Status.DRAFT, created_by=self.admin,
        )

    def test_reading_time_is_calculated(self):
        self.assertEqual(self.resource.reading_time, 2)

    def test_admin_can_publish_by_uuid(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f"/api/resources/admin/{self.resource.id}/publish/")
        self.assertEqual(response.status_code, 200)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.status, Resource.Status.PUBLISHED)
        self.assertIsNotNone(self.resource.published_at)

    def test_admin_can_update_and_replace_references(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/resources/admin/{self.resource.id}/"
        refs = [{"author": "WHO", "year": 2022, "title": "Mental health", "publication": "", "url": "", "doi": ""}]
        response = self.client.patch(url, {"title": "Sleep better", "references": refs}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.title, "Sleep better")
        self.assertEqual(self.resource.references.count(), 1)

    def test_students_cannot_use_admin_endpoints(self):
        self.client.force_authenticate(user=self.student)
        self.assertEqual(self.client.post(f"/api/resources/admin/{self.resource.id}/publish/").status_code, 403)

    def test_student_list_includes_media_fields(self):
        self.resource.status = Resource.Status.PUBLISHED
        self.resource.save()
        self.client.force_authenticate(user=self.student)
        item = self.client.get("/api/resources/").data[0]
        for key in ("audio_file", "video_file", "cover_image", "reading_time", "references"):
            self.assertIn(key, item)



class SeedArticlesTests(APITestCase):
    def test_seed_creates_twenty_articles_and_is_repeatable(self):
        from django.core.management import call_command
        call_command("seed_articles", verbosity=0)
        call_command("seed_articles", verbosity=0)
        self.assertEqual(Resource.objects.filter(type="article").count(), 20)
        self.assertEqual(ResourceCategory.objects.count(), 6)
        self.assertEqual(Resource.objects.filter(status=Resource.Status.PUBLISHED).count(), 0)
        first = Resource.objects.get(title="Why Do Exams Make Us Anxious?")
        self.assertEqual(first.references.count(), 3)
        self.assertTrue(first.reading_time >= 1)

    def test_publish_flag_and_n_d_reference(self):
        from django.core.management import call_command
        call_command("seed_articles", "--publish", verbosity=0)
        self.assertEqual(Resource.objects.filter(status=Resource.Status.PUBLISHED).count(), 20)
        nimh = ResourceReference.objects.filter(author__startswith="National Institute").first()
        self.assertIsNone(nimh.year)
        self.assertIn("(n.d.)", nimh.apa_text)


class SeedAudioCommandTests(APITestCase):
    def test_adds_audio_resources_and_is_repeatable(self):
        import shutil
        import subprocess
        import tempfile
        from pathlib import Path

        from django.core.management import call_command
        from django.test import override_settings

        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg is not installed")
        with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as media:
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=2", str(Path(source) / "liecio-light-rain-109591.mp3")],
                check=True,
            )
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=2", str(Path(source) / "FreeMindfulness3MinuteBreathing.mp3")],
                check=True,
            )
            with override_settings(MEDIA_ROOT=media):
                call_command("seed_audio", source=source, publish=True, verbosity=0)
                call_command("seed_audio", source=source, publish=True, verbosity=0)
                rain = Resource.objects.get(title="Light rain")
                guided = Resource.objects.get(title="3-minute breathing space")
                self.assertEqual(Resource.objects.filter(type="audio").count(), 2)
                self.assertEqual(rain.status, Resource.Status.PUBLISHED)
                self.assertEqual(guided.status, Resource.Status.PENDING_REVIEW)
                self.assertTrue(rain.audio_file.name.endswith(".mp3"))
