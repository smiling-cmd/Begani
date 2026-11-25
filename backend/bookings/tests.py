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

    def test_private_therapist_has_no_class_groups(self):
        self.api_client.force_authenticate(user=self.therapist_user)
        data = self.api_client.get('/api/bookings/insights/').data
        self.assertEqual(data['audience'], 'private')
        self.assertEqual(data['groups'], [])

    def test_school_counsellor_sees_classes_and_small_groups_are_folded(self):
        from accounts.models import ClassGroup, University
        self.therapist.type = TherapistProfile.Type.SCHOOL
        self.therapist.fee_kes = None
        self.therapist.save()
        school = University.objects.create(name='JKUAT')
        big = ClassGroup.objects.create(university=school, name='BBIT Year 3')
        small = ClassGroup.objects.create(university=school, name='MSc Year 1')

        def add_student(index, group):
            user = User.objects.create_user(email=f's{index}@example.com', password='pw-12345', role=User.Role.STUDENT)
            return StudentProfile.objects.create(user=user, alias=f's{index}', class_group=group)

        for index in range(3):
            self.student = add_student(index, big)
            self.create_booking(offset_days=2 + index)
        self.student = add_student(9, small)
        self.create_booking(offset_days=9)
        self.api_client.force_authenticate(user=self.therapist_user)

        data = self.api_client.get('/api/bookings/insights/').data

        self.assertEqual(data['audience'], 'school')
        self.assertEqual(data['schools'], [])
        names = {group['name']: group['count'] for group in data['groups']}
        self.assertEqual(names, {'BBIT Year 3': 3, 'Other groups': 1})
        self.assertNotIn('MSc Year 1', names)

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


class StudentAppointmentsTests(BookingCreateTests):
    def book(self):
        response = self.client.post('/api/bookings/create/', {'slot_id': str(self.slot.id)}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Booking.objects.get(slot=self.slot)

    def test_lists_all_statuses_with_counsellor_details(self):
        booking = self.book()
        rows = self.client.get('/api/bookings/appointments/').json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['id'], str(booking.id))
        self.assertEqual(rows[0]['status'], 'requested')
        self.assertEqual(rows[0]['therapist_name'], 'Test Therapist')
        self.assertEqual(rows[0]['format'], 'online')
        self.assertIn('therapist_id', rows[0])

    def test_other_students_do_not_see_my_appointments(self):
        self.book()
        other = User.objects.create_user(email='other@example.com', password='x', role=User.Role.STUDENT)
        StudentProfile.objects.create(user=other, alias='other')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.get('/api/bookings/appointments/').json(), [])

    def test_student_can_cancel_and_slot_reopens(self):
        booking = self.book()
        response = self.client.post(f'/api/bookings/{booking.id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()['status'], 'cancelled_by_student')
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)

    def test_cannot_cancel_twice_or_someone_elses_booking(self):
        booking = self.book()
        self.client.post(f'/api/bookings/{booking.id}/cancel/', {}, format='json')
        again = self.client.post(f'/api/bookings/{booking.id}/cancel/', {}, format='json')
        self.assertEqual(again.status_code, 400)
        other = User.objects.create_user(email='other2@example.com', password='x', role=User.Role.STUDENT)
        StudentProfile.objects.create(user=other, alias='other2')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.post(f'/api/bookings/{booking.id}/cancel/', {}, format='json').status_code, 404)

    def test_cannot_cancel_after_start(self):
        booking = self.book()
        Booking.objects.filter(id=booking.id).update(starts_at=timezone.now() - timedelta(minutes=5))
        response = self.client.post(f'/api/bookings/{booking.id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, 400)
