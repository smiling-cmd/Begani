from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import StudentProfile, User
from .models import Activity, ActivityRegistration


class ActivityListTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="student@example.ac.ke",
            password="test-password",
            role="student",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        Activity.objects.create(
            title="Upcoming activity",
            type=Activity.Type.YOGA,
            starts_at=timezone.now() + timedelta(days=1),
            location_text="Campus hall",
            capacity=12,
            fee_kes=0,
            status=Activity.Status.PUBLISHED,
        )
        Activity.objects.create(
            title="Cancelled activity",
            type=Activity.Type.YOGA,
            starts_at=timezone.now() + timedelta(days=2),
            location_text="Campus hall",
            capacity=12,
            status=Activity.Status.CANCELLED,
        )
        Activity.objects.create(
            title="Past activity",
            type=Activity.Type.YOGA,
            starts_at=timezone.now() - timedelta(days=1),
            location_text="Campus hall",
            capacity=12,
        )

    def test_lists_only_published_upcoming_activities(self):
        response = self.client.get("/api/activities/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Upcoming activity")
        self.assertEqual(data[0]["capacity"], 12)


class ActivityRegistrationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="joiner@example.ac.ke",
            password="test-password",
            role="student",
        )
        self.student = StudentProfile.objects.create(user=self.user, alias="Joiner")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.activity = Activity.objects.create(
            title="Free yoga",
            type=Activity.Type.YOGA,
            starts_at=timezone.now() + timedelta(days=1),
            location_text="Campus hall",
            capacity=2,
            fee_kes=0,
            status=Activity.Status.PUBLISHED,
        )

    def test_registers_student_and_lists_saved_registration(self):
        response = self.client.post(f"/api/activities/{self.activity.id}/register/", {}, format="json")

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["activity"], str(self.activity.id))
        self.assertEqual(data["status"], ActivityRegistration.Status.REGISTERED)
        self.assertTrue(
            ActivityRegistration.objects.filter(activity=self.activity, student=self.student).exists()
        )

        registrations = self.client.get("/api/activities/registrations/")
        self.assertEqual(registrations.status_code, 200)
        self.assertEqual(len(registrations.json()), 1)

    def test_duplicate_registration_is_idempotent(self):
        url = f"/api/activities/{self.activity.id}/register/"
        first_response = self.client.post(url, {}, format="json")
        second_response = self.client.post(url, {}, format="json")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(ActivityRegistration.objects.filter(activity=self.activity, student=self.student).count(), 1)

    def test_rejects_paid_activity_until_checkout_is_available(self):
        self.activity.fee_kes = 300
        self.activity.save(update_fields=("fee_kes",))

        response = self.client.post(f"/api/activities/{self.activity.id}/register/", {}, format="json")

        self.assertEqual(response.status_code, 409)
        self.assertFalse(ActivityRegistration.objects.filter(activity=self.activity).exists())

    def test_rejects_registration_when_activity_is_full(self):
        other_user = User.objects.create_user(
            email="other@example.ac.ke",
            password="test-password",
            role="student",
        )
        other_student = StudentProfile.objects.create(user=other_user, alias="Other")
        self.activity.capacity = 1
        self.activity.save(update_fields=("capacity",))
        ActivityRegistration.objects.create(activity=self.activity, student=other_student)

        response = self.client.post(f"/api/activities/{self.activity.id}/register/", {}, format="json")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(ActivityRegistration.objects.filter(activity=self.activity).count(), 1)


class AdminActivityCreateTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="activity-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            is_active=True,
            is_staff=False,
        )
        self.student = User.objects.create_user(
            email="activity-student@example.ac.ke",
            password="test-password",
            role=User.Role.STUDENT,
            is_active=True,
        )

    def test_admin_can_create_published_activity(self):
        self.client.force_authenticate(user=self.admin)
        starts_at = timezone.now() + timedelta(days=2)

        response = self.client.post(
            "/api/activities/admin/create/",
            {
                "title": "Campus yoga",
                "type": Activity.Type.YOGA,
                "description": "A beginner-friendly session.",
                "starts_at": starts_at.isoformat(),
                "duration_minutes": 75,
                "location_text": "Campus hall",
                "capacity": 20,
                "fee_kes": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        activity = Activity.objects.get(id=response.data["id"])
        self.assertEqual(activity.status, Activity.Status.PUBLISHED)
        self.assertEqual(activity.created_by, self.admin)
        self.assertEqual(activity.capacity, 20)

        self.client.force_authenticate(user=self.student)
        student_activities = self.client.get("/api/activities/")
        self.assertEqual(student_activities.status_code, 200)
        self.assertEqual(student_activities.data[0]["title"], "Campus yoga")

    def test_non_admin_cannot_create_activities(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            "/api/activities/admin/create/",
            {
                "title": "Campus yoga",
                "type": Activity.Type.YOGA,
                "starts_at": (timezone.now() + timedelta(days=2)).isoformat(),
                "location_text": "Campus hall",
                "capacity": 20,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Activity.objects.exists())
