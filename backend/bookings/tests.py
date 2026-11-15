from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from counsellors.models import AvailabilitySlot, TherapistProfile
from .models import Booking


class TherapistInsightsTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.therapist_user = User.objects.create_user(
            email='insights-therapist@example.com',
            password='test-password',
            role=User.Role.THERAPIST,
        )
        self.therapist = TherapistProfile.objects.create(
            user=self.therapist_user,
            type=TherapistProfile.Type.PRIVATE,
            category=TherapistProfile.Category.COUNSELLOR,
            display_name='Insights Therapist',
            format=TherapistProfile.Format.ONLINE,
            fee_kes=1200,
        )
        self.student_user = User.objects.create_user(
            email='insights-student@example.com',
            password='test-password',
            role=User.Role.STUDENT,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            alias='insights-student',
        )

    def create_booking(self, status=Booking.Status.REQUESTED, offset_days=2):
        starts_at = timezone.now() + timedelta(days=offset_days)
        slot = AvailabilitySlot.objects.create(
            therapist=self.therapist,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(minutes=50),
        )
        return Booking.objects.create(
            student=self.student,
            therapist=self.therapist,
            slot=slot,
            starts_at=starts_at,
            status=status,
            fee_kes_snapshot=1200,
            confirm_by=timezone.now() + timedelta(hours=48),
        )

    def test_therapist_receives_aggregated_counts(self):
        self.create_booking()
        self.create_booking(status=Booking.Status.CONFIRMED, offset_days=3)
        self.create_booking(status=Booking.Status.DECLINED, offset_days=4)
        self.api_client.force_authenticate(user=self.therapist_user)

        response = self.api_client.get('/api/bookings/insights/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['booked_this_year'], 2)
        self.assertEqual(response.data['awaiting_confirmation'], 1)
        self.assertEqual(response.data['upcoming_appointments'], 1)
        self.assertEqual(len(response.data['monthly']), timezone.now().month)
        self.assertEqual(response.data['schools'][0]['name'], 'Not provided')
        self.assertEqual(response.data['schools'][0]['count'], 2)

    def test_students_cannot_view_insights(self):
        self.api_client.force_authenticate(user=self.student_user)

        response = self.api_client.get('/api/bookings/insights/')

        self.assertEqual(response.status_code, 403)


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
