from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User
from .models import TherapistProfile, TherapistVerification


class AdminTherapistAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='university-admin@example.com',
            password='test-password',
            role=User.Role.ADMIN,
            is_active=True,
            is_staff=False,
        )
        self.therapist_user = User.objects.create_user(
            email='therapist@example.com',
            password='test-password',
            role=User.Role.THERAPIST,
            is_active=True,
        )
        self.therapist = TherapistProfile.objects.create(
            user=self.therapist_user,
            type=TherapistProfile.Type.PRIVATE,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name='Pending therapist',
            format=TherapistProfile.Format.ONLINE,
            status=TherapistProfile.Status.PENDING,
        )

    def test_role_admin_can_list_all_therapists_without_is_staff(self):
        TherapistVerification.objects.create(
            therapist=self.therapist,
            registration_body='Professional Board',
            registration_number='REG-123',
            licence_expiry=date(2030, 1, 1),
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get('/api/counsellors/admin/list/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['email'], self.therapist_user.email)
        self.assertEqual(response.data[0]['registration_number'], 'REG-123')
        self.assertEqual(response.data[0]['licence_expiry'], date(2030, 1, 1))

    def test_non_admin_cannot_list_or_approve_therapists(self):
        self.client.force_authenticate(user=self.therapist_user)

        list_response = self.client.get('/api/counsellors/admin/list/')
        action_response = self.client.post(
            f'/api/counsellors/admin/{self.therapist.id}/approve/',
            {'action': 'approve'},
            format='json',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertEqual(action_response.status_code, 403)
        self.therapist.refresh_from_db()
        self.assertEqual(self.therapist.status, TherapistProfile.Status.PENDING)

    def test_approval_requires_registration_details(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            f'/api/counsellors/admin/{self.therapist.id}/approve/',
            {'action': 'approve'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.therapist.refresh_from_db()
        self.assertEqual(self.therapist.status, TherapistProfile.Status.PENDING)

    def test_admin_can_approve_and_reject_therapists(self):
        TherapistVerification.objects.create(
            therapist=self.therapist,
            registration_body='Professional Board',
            registration_number='REG-123',
            licence_expiry=date(2030, 1, 1),
        )
        self.client.force_authenticate(user=self.admin)

        approve_response = self.client.post(
            f'/api/counsellors/admin/{self.therapist.id}/approve/',
            {'action': 'approve'},
            format='json',
        )

        self.assertEqual(approve_response.status_code, 200)
        self.therapist.refresh_from_db()
        self.assertEqual(self.therapist.status, TherapistProfile.Status.APPROVED)

        reject_response = self.client.post(
            f'/api/counsellors/admin/{self.therapist.id}/approve/',
            {'action': 'reject'},
            format='json',
        )

        self.assertEqual(reject_response.status_code, 200)
        self.therapist.refresh_from_db()
        self.assertEqual(self.therapist.status, TherapistProfile.Status.SUSPENDED)
