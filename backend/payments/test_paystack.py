import hashlib
import hmac
import json
from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from activities.models import Activity, ActivityRegistration
from bookings.models import Booking
from counsellors.models import AvailabilitySlot, TherapistProfile

from . import paystack
from .models import LedgerEntry, Payment, Payout, Refund
from .services import expire_unpaid_registrations

KEY = "sk_test_dummy"


def make_student(email="pay-student@example.com"):
    user = User.objects.create_user(email=email, password="x", role=User.Role.STUDENT)
    return user, StudentProfile.objects.create(user=user, alias=email.split("@")[0])


@override_settings(PAYSTACK_SECRET_KEY=KEY)
class PaymentTestBase(TestCase):
    def setUp(self):
        self.user, self.student = make_student()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        t_user = User.objects.create_user(email="pay-t@example.com", password="x", role=User.Role.THERAPIST)
        self.therapist = TherapistProfile.objects.create(
            user=t_user, type=TherapistProfile.Type.PRIVATE, category=TherapistProfile.Category.COUNSELLOR,
            display_name="T", format=TherapistProfile.Format.ONLINE, fee_kes=1000,
        )

    def booking(self, status=Booking.Status.CONFIRMED):
        starts = timezone.now() + timedelta(days=2)
        slot = AvailabilitySlot.objects.create(therapist=self.therapist, starts_at=starts, ends_at=starts + timedelta(minutes=50))
        return Booking.objects.create(
            student=self.student, therapist=self.therapist, slot=slot, starts_at=starts, status=status,
            fee_kes_snapshot=1000, confirm_by=timezone.now() + timedelta(hours=48),
        )

    def activity_registration(self, fee=500, status=ActivityRegistration.Status.PENDING_PAYMENT):
        act = Activity.objects.create(
            title="Hike", type="hiking", starts_at=timezone.now() + timedelta(days=3),
            location_text="Ngong", capacity=10, fee_kes=fee,
        )
        return ActivityRegistration.objects.create(activity=act, student=self.student, status=status)

    def pay(self, url, phone="0712345678"):
        with mock.patch.object(paystack, "charge_mpesa", return_value={"status": "pay_offline"}) as m:
            r = self.client.post(url, {"phone": phone}, format="json")
        return r, m


class PhoneTests(TestCase):
    def test_normalize(self):
        for raw in ("0712345678", "712345678", "+254712345678", "254 712 345 678", "0112345678"):
            self.assertTrue(paystack.normalize_phone(raw).startswith("+254"), raw)
        self.assertEqual(paystack.normalize_phone("0712 345 678"), "+254712345678")
        for bad in ("", "12345", "0812345678", "+255712345678"):
            self.assertIsNone(paystack.normalize_phone(bad), bad)


class BookingPaymentTests(PaymentTestBase):
    def test_start_payment_and_charge_args(self):
        b = self.booking()
        r, m = self.pay(f"/api/payments/booking/{b.id}/pay/")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "pending")
        kw = m.call_args.kwargs
        self.assertEqual((kw["amount_kes"], kw["phone"]), (1000, "+254712345678"))
        self.assertNotIn("0712345678", json.dumps(r.data, default=str))

    def test_requires_confirmed_and_ownership_and_valid_phone(self):
        b = self.booking(Booking.Status.REQUESTED)
        self.assertEqual(self.pay(f"/api/payments/booking/{b.id}/pay/")[0].status_code, 409)
        b2 = self.booking()
        self.assertEqual(self.pay(f"/api/payments/booking/{b2.id}/pay/", phone="123")[0].status_code, 400)
        other, _ = make_student("other-pay@example.com")
        self.client.force_authenticate(other)
        self.assertEqual(self.pay(f"/api/payments/booking/{b2.id}/pay/")[0].status_code, 404)

    def test_inflight_payment_is_reused(self):
        b = self.booking()
        r1, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        r2, m2 = self.pay(f"/api/payments/booking/{b.id}/pay/")
        self.assertEqual(r1.data["id"], r2.data["id"])
        m2.assert_not_called()
        self.assertEqual(Payment.objects.count(), 1)

    def test_poll_verify_success_creates_ledger_and_payout_once(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        ref = Payment.objects.get().reference
        ok = {"status": "success", "amount": 100000, "currency": "KES", "receipt_number": "ABC123"}
        with mock.patch.object(paystack, "verify", return_value=ok):
            s = self.client.get(f"/api/payments/{r.data['id']}/")
            self.assertEqual(s.data["status"], "succeeded")
            self.client.get(f"/api/payments/{r.data['id']}/")
        self.assertEqual(LedgerEntry.objects.filter(type="payment_in").count(), 1)
        payout = Payout.objects.get(booking=b)
        self.assertEqual((payout.gross_kes, payout.commission_kes, payout.net_kes), (1000, 100, 900))
        self.assertTrue(ref)
        # paid -> appointment shows paid, and can't pay again
        self.assertEqual(self.client.get("/api/bookings/appointments/").data[0]["payment_status"], "paid")
        self.assertEqual(self.pay(f"/api/payments/booking/{b.id}/pay/")[0].status_code, 409)

    def test_amount_mismatch_fails(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        bad = {"status": "success", "amount": 100, "currency": "KES"}
        with mock.patch.object(paystack, "verify", return_value=bad):
            self.assertEqual(self.client.get(f"/api/payments/{r.data['id']}/").data["status"], "failed")
        self.assertFalse(Payout.objects.exists())

    def test_failed_then_retry_allowed(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        with mock.patch.object(paystack, "verify", return_value={"status": "failed", "gateway_response": "Declined"}):
            self.assertEqual(self.client.get(f"/api/payments/{r.data['id']}/").data["status"], "failed")
        self.assertEqual(self.pay(f"/api/payments/booking/{b.id}/pay/")[0].status_code, 201)

    def test_timeout(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        Payment.objects.update(initiated_at=timezone.now() - timedelta(minutes=6))
        with mock.patch.object(paystack, "verify", return_value={"status": "pending"}):
            self.assertEqual(self.client.get(f"/api/payments/{r.data['id']}/").data["status"], "timed_out")

    def test_cancel_paid_booking_queues_refund_and_drops_payout(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        ok = {"status": "success", "amount": 100000, "currency": "KES"}
        with mock.patch.object(paystack, "verify", return_value=ok):
            self.client.get(f"/api/payments/{r.data['id']}/")
        res = self.client.post(f"/api/bookings/{b.id}/cancel/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Refund.objects.get().amount, 1000)
        self.assertFalse(Payout.objects.exists())

    def test_not_configured_returns_503(self):
        b = self.booking()
        with override_settings(PAYSTACK_SECRET_KEY=""):
            r = self.client.post(f"/api/payments/booking/{b.id}/pay/", {"phone": "0712345678"}, format="json")
        self.assertEqual(r.status_code, 503)

    def test_cannot_read_other_students_payment(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        other, _ = make_student("peek@example.com")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(f"/api/payments/{r.data['id']}/").status_code, 404)


class WebhookTests(PaymentTestBase):
    def post(self, body, sig=None):
        raw = json.dumps(body).encode()
        sig = sig if sig is not None else hmac.new(KEY.encode(), raw, hashlib.sha512).hexdigest()
        return APIClient().post("/api/payments/webhook/", raw, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=sig)

    def test_bad_signature_rejected(self):
        self.assertEqual(self.post({"event": "charge.success", "data": {}}, sig="nope").status_code, 401)

    def test_valid_webhook_settles_idempotently(self):
        reg = self.activity_registration()
        r, _ = self.pay(f"/api/payments/registration/{reg.id}/pay/")
        ref = Payment.objects.get().reference
        body = {"event": "charge.success", "data": {"reference": ref, "status": "success", "amount": 50000, "currency": "KES"}}
        self.assertEqual(self.post(body).status_code, 200)
        self.assertEqual(self.post(body).status_code, 200)
        reg.refresh_from_db()
        self.assertEqual(reg.status, ActivityRegistration.Status.REGISTERED)
        self.assertEqual(LedgerEntry.objects.count(), 1)

    def test_paid_after_cancel_gets_refund(self):
        reg = self.activity_registration()
        self.pay(f"/api/payments/registration/{reg.id}/pay/")
        ref = Payment.objects.get().reference
        reg.status = ActivityRegistration.Status.CANCELLED
        reg.save()
        self.post({"event": "charge.success", "data": {"reference": ref, "status": "success", "amount": 50000, "currency": "KES"}})
        self.assertEqual(Refund.objects.count(), 1)
        reg.refresh_from_db()
        self.assertEqual(reg.status, ActivityRegistration.Status.CANCELLED)


class ActivityFlowTests(PaymentTestBase):
    def test_paid_activity_registers_as_pending_payment(self):
        act = Activity.objects.create(
            title="Trip", type="trip", starts_at=timezone.now() + timedelta(days=3),
            location_text="X", capacity=5, fee_kes=300,
        )
        r = self.client.post(f"/api/activities/{act.id}/register/")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["status"], r.data["payment_status"], r.data["fee_kes"]), ("pending_payment", "unpaid", 300))

    def test_free_activity_still_registers_directly(self):
        act = Activity.objects.create(
            title="Yoga", type="yoga", starts_at=timezone.now() + timedelta(days=3),
            location_text="X", capacity=5, fee_kes=0,
        )
        r = self.client.post(f"/api/activities/{act.id}/register/")
        self.assertEqual(r.data["status"], "registered")

    def test_unpaid_registration_expires(self):
        reg = self.activity_registration()
        ActivityRegistration.objects.filter(pk=reg.pk).update(registered_at=timezone.now() - timedelta(hours=1))
        expire_unpaid_registrations()
        reg.refresh_from_db()
        self.assertEqual(reg.status, ActivityRegistration.Status.CANCELLED)


class ChargeParsingTests(TestCase):
    @override_settings(PAYSTACK_SECRET_KEY=KEY)
    def test_charge_attempted_with_status_false_still_returns_charge_data(self):
        body = {"status": False, "message": "Charge attempted", "data": {"status": "pay_offline", "reference": "r"}}
        with mock.patch.object(paystack, "_raw", return_value=(True, body)):
            data = paystack.charge_mpesa(email="a@b.c", amount_kes=5, phone="+254712345678", reference="r")
        self.assertEqual(data["status"], "pay_offline")

    @override_settings(PAYSTACK_SECRET_KEY=KEY)
    def test_charge_without_data_raises_with_message(self):
        with mock.patch.object(paystack, "_raw", return_value=(False, {"status": False, "message": "Invalid key"})):
            with self.assertRaises(paystack.PaystackError):
                paystack.charge_mpesa(email="a@b.c", amount_kes=5, phone="+254712345678", reference="r")


class TherapistVisibilityAndAdminTests(PaymentTestBase):
    def test_therapist_sees_payment_status(self):
        b = self.booking()
        r, _ = self.pay(f"/api/payments/booking/{b.id}/pay/")
        t = APIClient()
        t.force_authenticate(self.therapist.user)
        from bookings.serializers import TherapistBookingSerializer
        self.assertEqual(TherapistBookingSerializer(b).data["payment_status"], "processing")
        with mock.patch.object(paystack, "verify", return_value={"status": "success", "amount": 100000, "currency": "KES"}):
            self.client.get(f"/api/payments/{r.data['id']}/")
        b = Booking.objects.get(pk=b.pk)
        self.assertEqual(TherapistBookingSerializer(b).data["payment_status"], "paid")

    def test_admin_mark_paid_writes_ledger_once(self):
        from django.contrib.admin.sites import site
        from django.test import RequestFactory
        b = self.booking()
        payout = Payout.objects.create(booking=b, gross_kes=1000, commission_rate_percent=10)
        admin_obj = site._registry[Payout]
        req = RequestFactory().post("/")
        req.user = self.user
        req._messages = mock.MagicMock()
        admin_obj.mark_paid(req, Payout.objects.all())
        admin_obj.mark_paid(req, Payout.objects.all())
        payout.refresh_from_db()
        self.assertEqual(payout.status, "paid")
        self.assertEqual(LedgerEntry.objects.filter(type="payout_out").count(), 1)
