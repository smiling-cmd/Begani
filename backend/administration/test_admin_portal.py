from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from activities.models import Activity, ActivityRegistration
from administration.models import AuditLog
from bookings.models import Booking
from counsellors.models import AvailabilitySlot, TherapistProfile, TherapistVerification
from payments.models import Payment, Refund
from resources.models import Resource, ResourceCategory

THERAPIST = {
    "email": "New.Therapist@example.com", "full_name": "Dr Amina Otieno", "display_name": "Dr. Amina",
    "type": "private", "category": "psychologist", "format": "online", "fee_kes": 2500,
    "registration_body": "KCPA", "registration_number": "REG-123",
    "licence_expiry": (date.today() + timedelta(days=200)).isoformat(),
}


class AdminBase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@x.ac.ke", password="x", role=User.Role.ADMIN, is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.student_user = User.objects.create_user(email="s@x.ac.ke", password="x", role=User.Role.STUDENT, is_active=True)
        self.student = StudentProfile.objects.create(user=self.student_user, alias="quietfox")


class TherapistAdminTests(AdminBase):
    def create(self, **over):
        return self.client.post("/api/counsellors/admin/create/", {**THERAPIST, **over}, format="json")

    def test_only_admins(self):
        c = APIClient()
        c.force_authenticate(self.student_user)
        self.assertEqual(c.post("/api/counsellors/admin/create/", THERAPIST, format="json").status_code, 403)

    def test_create_makes_active_account_pending_profile_and_one_time_password(self):
        r = self.create()
        self.assertEqual(r.status_code, 201, r.data)
        user = User.objects.get(email="new.therapist@example.com")
        self.assertTrue(user.is_active)
        self.assertEqual(user.role, "therapist")
        self.assertTrue(user.check_password(r.data["temporary_password"]))
        self.assertEqual(user.therapist_profile.status, "pending")
        self.assertEqual(user.therapist_profile.verification.registration_number, "REG-123")
        self.assertTrue(AuditLog.objects.filter(action="therapist.create").exists())
        # the password is never shown again
        detail = self.client.get(f"/api/counsellors/admin/{r.data['therapist']['id']}/")
        self.assertNotIn("temporary_password", detail.data)

    def test_create_validation(self):
        self.create()
        self.assertEqual(self.create().status_code, 400)  # duplicate email
        self.assertEqual(self.create(email="a@b.co", fee_kes=None).status_code, 400)  # private needs fee
        self.assertEqual(self.create(email="c@b.co", category="school_staff").status_code, 400)
        school = self.create(email="d@b.co", type="school_counsellor", category="school_staff", fee_kes=500)
        self.assertEqual(school.status_code, 201)
        self.assertIsNone(school.data["therapist"]["fee_kes"])

    def test_cannot_approve_until_checklist_ticked_then_can(self):
        tid = self.create().data["therapist"]["id"]
        self.assertEqual(self.client.post(f"/api/counsellors/admin/{tid}/approve/", {"action": "approve"}, format="json").status_code, 400)
        checks = dict(register_checked=True, licence_current=True, category_matches=True, id_matched=True, certificates_seen=True)
        r = self.client.patch(f"/api/counsellors/admin/{tid}/", checks, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        ok = self.client.post(f"/api/counsellors/admin/{tid}/approve/", {"action": "approve"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(TherapistProfile.objects.get(pk=tid).status, "approved")
        self.assertTrue(AuditLog.objects.filter(action="therapist.approve").exists())

    def test_edit_profile_and_user_fields(self):
        tid = self.create().data["therapist"]["id"]
        r = self.client.patch(f"/api/counsellors/admin/{tid}/", {"display_name": "Dr. A. Otieno", "full_name": "Amina O.", "fee_kes": 3000, "registration_number": "NEW-9"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        t = TherapistProfile.objects.get(pk=tid)
        self.assertEqual((t.display_name, t.fee_kes, t.user.full_name, t.verification.registration_number), ("Dr. A. Otieno", 3000, "Amina O.", "NEW-9"))
        self.assertEqual(self.client.patch(f"/api/counsellors/admin/{tid}/", {"fee_kes": 0}, format="json").status_code, 400)

    def test_delete_only_without_bookings(self):
        tid = self.create().data["therapist"]["id"]
        self.assertEqual(self.client.delete(f"/api/counsellors/admin/{tid}/").status_code, 204)
        self.assertFalse(User.objects.filter(email="new.therapist@example.com").exists())
        t2 = self.create(email="busy@example.com").data["therapist"]["id"]
        therapist = TherapistProfile.objects.get(pk=t2)
        starts = timezone.now() + timedelta(days=2)
        slot = AvailabilitySlot.objects.create(therapist=therapist, starts_at=starts, ends_at=starts + timedelta(minutes=50))
        Booking.objects.create(student=self.student, therapist=therapist, slot=slot, starts_at=starts, fee_kes_snapshot=2500, confirm_by=starts)
        r = self.client.delete(f"/api/counsellors/admin/{t2}/")
        self.assertEqual(r.status_code, 409)
        self.assertTrue(TherapistProfile.objects.filter(pk=t2).exists())


class ActivityAdminTests(AdminBase):
    def activity(self, **over):
        data = dict(title="Hike", type="hiking", starts_at=timezone.now() + timedelta(days=5), location_text="Ngong", capacity=3, fee_kes=0)
        data.update(over)
        return Activity.objects.create(**data)

    def register(self, activity, status=ActivityRegistration.Status.REGISTERED, alias="s1"):
        u = User.objects.create_user(email=f"{alias}@x.ac.ke", password="x", role="student", is_active=True)
        sp = StudentProfile.objects.create(user=u, alias=alias)
        return ActivityRegistration.objects.create(activity=activity, student=sp, status=status)

    def test_list_includes_all_statuses_and_counts(self):
        a = self.activity()
        self.activity(title="Old", status=Activity.Status.CANCELLED)
        self.register(a)
        rows = self.client.get("/api/activities/admin/").data
        self.assertEqual(len(rows), 2)
        hike = next(r for r in rows if r["title"] == "Hike")
        self.assertEqual((hike["taken"], hike["registrations_total"]), (1, 1))

    def test_edit_rules(self):
        a = self.activity(capacity=3)
        self.register(a, alias="a")
        self.register(a, alias="b")
        url = f"/api/activities/admin/{a.id}/"
        self.assertEqual(self.client.patch(url, {"title": "Sunrise hike", "fee_kes": 300}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(url, {"capacity": 1}, format="json").status_code, 400)  # 2 already in
        past = (timezone.now() - timedelta(days=1)).isoformat()
        self.assertEqual(self.client.patch(url, {"starts_at": past}, format="json").status_code, 400)
        old = self.activity(title="Past one", starts_at=timezone.now() - timedelta(days=2))
        same = self.client.patch(f"/api/activities/admin/{old.id}/", {"title": "Renamed"}, format="json")
        self.assertEqual(same.status_code, 200, same.data)  # unchanged past date is fine

    def test_delete_only_when_nobody_registered(self):
        free = self.activity()
        self.assertEqual(self.client.delete(f"/api/activities/admin/{free.id}/").status_code, 204)
        busy = self.activity(title="Busy")
        self.register(busy)
        self.assertEqual(self.client.delete(f"/api/activities/admin/{busy.id}/").status_code, 409)
        self.assertTrue(Activity.objects.filter(pk=busy.pk).exists())

    def test_cancel_releases_places_hides_activity_and_queues_refund_for_paid(self):
        a = self.activity(fee_kes=500)
        paid = self.register(a, alias="paid")
        unpaid = self.register(a, ActivityRegistration.Status.PENDING_PAYMENT, alias="unpaid")
        Payment.objects.create(registration=paid, amount=500, status=Payment.Status.SUCCEEDED, reference="r1")
        r = self.client.post(f"/api/activities/admin/{a.id}/cancel/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["released"], 2)
        for reg in (paid, unpaid):
            reg.refresh_from_db()
            self.assertEqual(reg.status, "cancelled")
        self.assertEqual(Refund.objects.count(), 1)
        self.assertEqual(Refund.objects.get().amount, 500)
        self.assertEqual(self.client.post(f"/api/activities/admin/{a.id}/cancel/").status_code, 400)
        s = APIClient()
        s.force_authenticate(self.student_user)
        self.assertEqual(len(s.get("/api/activities/").data), 0)
        self.assertEqual(s.post(f"/api/activities/{a.id}/register/").status_code, 404)

    def test_students_cannot_use_admin_endpoints(self):
        a = self.activity()
        s = APIClient()
        s.force_authenticate(self.student_user)
        self.assertEqual(s.get("/api/activities/admin/").status_code, 403)
        self.assertEqual(s.delete(f"/api/activities/admin/{a.id}/").status_code, 403)
        self.assertEqual(s.post(f"/api/activities/admin/{a.id}/cancel/").status_code, 403)


class ResourceAdminTests(AdminBase):
    def resource(self, status=Resource.Status.PUBLISHED):
        cat, _ = ResourceCategory.objects.get_or_create(slug="sleep", defaults={"name": "Sleep"})
        return Resource.objects.create(category=cat, type="article", title="Sleep better", body="Text", status=status, published_at=timezone.now())

    def test_edit_unpublish_publish_delete(self):
        res = self.resource()
        url = f"/api/resources/admin/{res.id}/"
        self.assertEqual(self.client.patch(url, {"title": "Sleep much better"}, format="json").status_code, 200)
        s = APIClient()
        s.force_authenticate(self.student_user)
        self.assertEqual(len(s.get("/api/resources/").data), 1)
        self.assertEqual(self.client.post(f"{url}unpublish/").status_code, 200)
        self.assertEqual(len(s.get("/api/resources/").data), 0)
        self.assertEqual(self.client.post(f"{url}unpublish/").status_code, 400)
        self.assertEqual(self.client.post(f"{url}publish/").status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(Resource.objects.filter(pk=res.pk).exists())

    def test_students_cannot_delete(self):
        res = self.resource()
        s = APIClient()
        s.force_authenticate(self.student_user)
        self.assertEqual(s.delete(f"/api/resources/admin/{res.id}/").status_code, 403)


class ResourceReferenceEditTests(ResourceAdminTests):
    def test_multipart_edit_replaces_then_clears_references(self):
        res = self.resource()
        url = f"/api/resources/admin/{res.id}/"
        r = self.client.patch(url, {"title": "Sleep v2", "references[0]author": "Walker", "references[0]year": "2017", "references[0]title": "Why we sleep", "references[0]order": "0"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([x.title for x in res.references.all()], ["Why we sleep"])
        r = self.client.patch(url, {"title": "Sleep v3", "clear_references": "true"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(res.references.count(), 0)
