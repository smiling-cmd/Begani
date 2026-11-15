from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from counsellors.models import AvailabilitySlot, TherapistProfile
from .models import Booking


class BookingCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        student_user = User.objects.create_user(
            email='student@example.com',
            password='test-password',
            role=User.Role.STUDENT,
        )
        StudentProfile.objects.create(user=student_user, alias='student')
        self.client.force_authenticate(user=student_user)

        therapist_user = User.objects.create_user(
            email='therapist@example.com',
            password='test-password',
            role=User.Role.THERAPIST,
        )
        therapist = TherapistProfile.objects.create(
            user=therapist_user,
            type=TherapistProfile.Type.PRIVATE,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name='Test Therapist',
            format=TherapistProfile.Format.ONLINE,
            fee_kes=1000,
        )
        starts_at = timezone.now() + timedelta(days=1)
        self.slot = AvailabilitySlot.objects.create(
            therapist=therapist,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(minutes=50),
        )

    def test_create_booking_with_only_slot_id(self):
        response = self.client.post(
            '/api/bookings/create/',
            {'slot_id': str(self.slot.id)},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        booking = Booking.objects.get(slot=self.slot)
        self.assertEqual(booking.status, Booking.Status.REQUESTED)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.BOOKED)
