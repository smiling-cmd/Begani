from rest_framework.test import APITestCase

from accounts.models import User
from counsellors.models import TherapistProfile


class EarningsAccessTests(APITestCase):
    def make_therapist(self, email, therapist_type):
        user = User.objects.create_user(email=email, password="x-test-pass", role=User.Role.THERAPIST, is_active=True)
        TherapistProfile.objects.create(
            user=user,
            type=therapist_type,
            category=list(TherapistProfile.Category.values)[0],
            display_name=email,
            format=list(TherapistProfile.Format.values)[0],
            status=TherapistProfile.Status.APPROVED,
        )
        return user

    def test_school_counsellor_has_no_earnings(self):
        user = self.make_therapist("school@example.com", TherapistProfile.Type.SCHOOL)
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get("/api/payments/earnings/").status_code, 403)

    def test_private_therapist_can_view_earnings(self):
        user = self.make_therapist("private@example.com", TherapistProfile.Type.PRIVATE)
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get("/api/payments/earnings/").status_code, 200)

    def test_profile_reports_therapist_type(self):
        user = self.make_therapist("school2@example.com", TherapistProfile.Type.SCHOOL)
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["therapist_type"], "school_counsellor")
