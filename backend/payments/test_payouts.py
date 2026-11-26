import hashlib
import hmac
import json
from unittest import mock

from django.contrib.admin.sites import site
from django.test import RequestFactory, override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from counsellors.models import TherapistProfile

from . import paystack, services
from .models import LedgerEntry, Payout, TherapistPayoutAccount
from .test_paystack import KEY, PaymentTestBase


@override_settings(PAYSTACK_SECRET_KEY=KEY)
class PayoutTests(PaymentTestBase):
    def setUp(self):
        super().setUp()
        self.t_client = APIClient()
        self.t_client.force_authenticate(self.therapist.user)

    def payout(self, status=Booking.Status.COMPLETED):
        b = self.booking(status)
        return Payout.objects.create(booking=b, gross_kes=1000, commission_rate_percent=10)

    def add_account(self):
        return TherapistPayoutAccount.objects.create(therapist=self.therapist, phone="254712345678", account_name="Amina Otieno")

    # --- account endpoint
    def test_account_save_masks_number_and_encrypts(self):
        r = self.t_client.put("/api/payments/payout-account/", {"phone": "0712 345 678", "account_name": "Amina Otieno"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotIn("712345678", json.dumps(r.data))
        self.assertTrue(r.data["has_account"])
        self.assertEqual(TherapistPayoutAccount.objects.get().phone, "254712345678")
        self.assertTrue(self.t_client.get("/api/payments/payout-account/").data["has_account"])

    def test_account_validation_and_roles(self):
        self.assertEqual(self.t_client.put("/api/payments/payout-account/", {"phone": "123", "account_name": "Amina"}, format="json").status_code, 400)
        self.assertEqual(self.t_client.put("/api/payments/payout-account/", {"phone": "0712345678", "account_name": "A"}, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/payments/payout-account/").status_code, 403)  # student
        self.therapist.type = TherapistProfile.Type.SCHOOL
        self.therapist.save()
        self.assertEqual(self.t_client.get("/api/payments/payout-account/").status_code, 403)

    def test_changing_number_resets_recipient(self):
        acc = self.add_account()
        acc.recipient_code = "RCP_old"
        acc.save()
        self.t_client.put("/api/payments/payout-account/", {"phone": "0722000111", "account_name": "Amina Otieno"}, format="json")
        acc.refresh_from_db()
        self.assertEqual((acc.phone, acc.recipient_code), ("254722000111", ""))

    # --- sending
    def test_payable_requires_completed_and_account(self):
        completed, other = self.payout(), self.payout(Booking.Status.CONFIRMED)
        self.assertEqual(services.payable_payouts().count(), 0)  # no account yet
        self.add_account()
        self.assertEqual(list(services.payable_payouts()), [completed])
        self.assertNotIn(other, services.payable_payouts())

    def test_send_payout_pending_then_webhook_success_pays_once(self):
        p = self.payout()
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", return_value="RCP_1") as cr, \
             mock.patch.object(paystack, "initiate_transfer", return_value={"status": "pending", "transfer_code": "TRF_1"}) as it:
            services.send_payout(p.pk)
        self.assertEqual(cr.call_args.kwargs["phone_e164"], "+254712345678")
        self.assertEqual(it.call_args.kwargs["amount_kes"], 900)  # net after 10%
        p.refresh_from_db()
        self.assertEqual((p.status, p.transfer_code), ("processing", "TRF_1"))
        body = {"event": "transfer.success", "data": {"reference": p.transfer_reference, "transfer_code": "TRF_1"}}
        raw = json.dumps(body).encode()
        sig = hmac.new(KEY.encode(), raw, hashlib.sha512).hexdigest()
        for _ in range(2):
            r = APIClient().post("/api/payments/webhook/", raw, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=sig)
            self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.status, "paid")
        self.assertEqual(LedgerEntry.objects.filter(type="payout_out").count(), 1)
        self.assertEqual(LedgerEntry.objects.get(type="payout_out").amount, 900)
        with self.assertRaises(services.PayoutError):
            services.send_payout(p.pk)  # can't send twice

    def test_otp_flow(self):
        p = self.payout()
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", return_value="RCP_1"), \
             mock.patch.object(paystack, "initiate_transfer", return_value={"status": "otp", "transfer_code": "TRF_2"}):
            services.send_payout(p.pk)
        p.refresh_from_db()
        self.assertEqual(p.status, "awaiting_otp")
        with mock.patch.object(paystack, "finalize_transfer", return_value={"status": "pending"}) as fin:
            services.finalize_payout(p.pk, "123456")
        self.assertEqual(fin.call_args.kwargs, {"transfer_code": "TRF_2", "otp": "123456"})
        p.refresh_from_db()
        self.assertEqual(p.status, "processing")

    def test_failed_transfer_returns_to_pending_with_reason_and_can_retry(self):
        p = self.payout()
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", return_value="RCP_1"), \
             mock.patch.object(paystack, "initiate_transfer", return_value={"status": "pending", "transfer_code": "TRF_3"}):
            services.send_payout(p.pk)
        p.refresh_from_db()
        first_ref = p.transfer_reference
        services.apply_transfer_event({"reference": first_ref, "status": "failed", "reason": "Wallet limit exceeded"})
        p.refresh_from_db()
        self.assertEqual((p.status, p.failure_reason), ("pending", "Wallet limit exceeded"))
        self.assertFalse(LedgerEntry.objects.filter(type="payout_out").exists())
        with mock.patch.object(paystack, "initiate_transfer", return_value={"status": "pending", "transfer_code": "TRF_4"}):
            services.send_payout(p.pk)
        p.refresh_from_db()
        self.assertNotEqual(p.transfer_reference, first_ref)

    def test_paystack_error_keeps_payout_pending(self):
        p = self.payout()
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", side_effect=paystack.PaystackError("Invalid number")):
            with self.assertRaises(services.PayoutError):
                services.send_payout(p.pk)
        p.refresh_from_db()
        self.assertEqual((p.status, p.failure_reason), ("pending", "Invalid number"))

    def test_send_requires_account_and_completed(self):
        p = self.payout()
        with self.assertRaises(services.PayoutError):
            services.send_payout(p.pk)
        self.add_account()
        Booking.objects.filter(pk=p.booking_id).update(status=Booking.Status.CONFIRMED)
        with self.assertRaises(services.PayoutError):
            services.send_payout(p.pk)

    def test_admin_manual_mark_paid_writes_ledger_once(self):
        p = self.payout()
        admin_obj = site._registry[Payout]
        req = RequestFactory().post("/")
        req.user = self.user
        req._messages = mock.MagicMock()
        admin_obj.mark_paid(req, Payout.objects.all())
        admin_obj.mark_paid(req, Payout.objects.all())
        p.refresh_from_db()
        self.assertEqual(p.status, "paid")
        self.assertEqual(LedgerEntry.objects.filter(type="payout_out").count(), 1)
