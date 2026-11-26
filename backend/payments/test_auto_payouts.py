from unittest import mock

from django.test import override_settings
from rest_framework.test import APIClient

from bookings.models import Booking

from . import paystack, services
from .models import Payout, PlatformSetting, TherapistPayoutAccount
from .test_paystack import KEY, PaymentTestBase

OK = {"status": "pending", "transfer_code": "TRF_A"}


@override_settings(PAYSTACK_SECRET_KEY=KEY)
class AutoPayoutTests(PaymentTestBase):
    def setUp(self):
        super().setUp()
        self.booking_obj = self.booking(Booking.Status.CONFIRMED)
        self.started(self.booking_obj)
        self.payout = Payout.objects.create(booking=self.booking_obj, gross_kes=1000, commission_rate_percent=10)

    def started(self, booking):
        from datetime import timedelta
        from django.utils import timezone
        Booking.objects.filter(pk=booking.pk).update(starts_at=timezone.now() - timedelta(hours=1))
        booking.refresh_from_db()

    def add_account(self):
        return TherapistPayoutAccount.objects.create(therapist=self.therapist, phone="254712345678", account_name="Amina Otieno")

    def test_cannot_complete_a_future_session(self):
        from datetime import timedelta
        from django.utils import timezone
        Booking.objects.filter(pk=self.booking_obj.pk).update(starts_at=timezone.now() + timedelta(days=1))
        self.booking_obj.refresh_from_db()
        with self.assertRaises(ValueError):
            self.booking_obj.transition("completed")
        self.booking_obj.refresh_from_db()
        self.assertEqual(self.booking_obj.status, Booking.Status.CONFIRMED)

    def complete(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.booking_obj.transition("completed")

    def patched(self):
        return mock.patch.object(paystack, "create_recipient", return_value="RCP_1"), \
            mock.patch.object(paystack, "initiate_transfer", return_value=OK)

    def test_completion_sends_payout_immediately(self):
        self.add_account()
        cr, it = self.patched()
        with cr, it as transfer:
            self.complete()
        transfer.assert_called_once()
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.PROCESSING)

    def test_no_number_stays_pending_then_adding_number_sends(self):
        cr, it = self.patched()
        with cr, it as transfer:
            self.complete()
            transfer.assert_not_called()
            t_client = APIClient()
            t_client.force_authenticate(self.therapist.user)
            with self.captureOnCommitCallbacks(execute=True):
                r = t_client.put("/api/payments/payout-account/", {"phone": "0712 345 678", "account_name": "Amina Otieno"}, format="json")
            self.assertEqual(r.status_code, 200, r.data)
            transfer.assert_called_once()
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.PROCESSING)

    def test_not_sent_before_completion(self):
        self.add_account()
        cr, it = self.patched()
        with cr, it as transfer:
            self.assertIsNone(services.try_auto_payout(self.payout.pk))
        transfer.assert_not_called()

    def test_admin_pause_and_env_switch_stop_sending(self):
        self.add_account()
        cr, it = self.patched()
        with cr, it as transfer:
            PlatformSetting.objects.create(key=services.PAUSE_KEY, value="1")
            self.complete()
            transfer.assert_not_called()
            PlatformSetting.objects.all().delete()
            with override_settings(AUTO_PAYOUTS_ENABLED=False):
                self.assertIsNone(services.try_auto_payout(self.payout.pk))
            transfer.assert_not_called()
            self.assertEqual(len(services.run_auto_payouts()), 1)  # sweep sends once unpaused
        transfer.assert_called_once()

    def test_daily_cap_defers_payout(self):
        self.add_account()
        self.booking_obj.status = Booking.Status.COMPLETED
        self.booking_obj.save()
        cr, it = self.patched()
        with cr, it as transfer, override_settings(AUTO_PAYOUT_DAILY_CAP_KES=500):
            self.assertIsNone(services.try_auto_payout(self.payout.pk))
        transfer.assert_not_called()
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.PENDING)
        self.assertIn("limit", self.payout.failure_reason)

    def test_paystack_error_never_breaks_completion(self):
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", side_effect=paystack.PaystackError("down")):
            self.complete()
        self.booking_obj.refresh_from_db()
        self.assertEqual(self.booking_obj.status, Booking.Status.COMPLETED)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.PENDING)
        self.assertEqual(self.payout.failure_reason, "down")

    def test_otp_enabled_leaves_payout_waiting_for_otp(self):
        self.add_account()
        with mock.patch.object(paystack, "create_recipient", return_value="RCP_1"), \
             mock.patch.object(paystack, "initiate_transfer", return_value={"status": "otp", "transfer_code": "TRF_B"}):
            self.complete()
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.AWAITING_OTP)


@override_settings(PAYSTACK_SECRET_KEY=KEY)
class DisableOtpCommandTests(PaymentTestBase):
    def run_cmd(self, *args):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command("disable_transfer_otp", *args, stdout=out)
        return out.getvalue()

    def test_two_step_flow(self):
        with mock.patch.object(paystack, "_request", return_value={"message": "OTP has been sent"}) as req:
            self.assertIn("--otp CODE", self.run_cmd())
            req.assert_called_with("POST", "/transfer/disable_otp")
            self.run_cmd("--otp", "123456")
            req.assert_called_with("POST", "/transfer/disable_otp_finalize", json={"otp": "123456"})

    def test_error_is_reported(self):
        from django.core.management.base import CommandError
        with mock.patch.object(paystack, "_request", side_effect=paystack.PaystackError("Not allowed")):
            with self.assertRaises(CommandError):
                self.run_cmd()


class PruneBookingsTests(PaymentTestBase):
    def run_cmd(self, *args):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command("prune_bookings", *args, stdout=out)
        return out.getvalue()

    def make_past(self, n):
        from datetime import timedelta
        from django.utils import timezone
        made = []
        for i in range(n):
            b = self.booking(Booking.Status.COMPLETED)
            Booking.objects.filter(pk=b.pk).update(starts_at=timezone.now() - timedelta(days=i + 1))
            Payout.objects.create(booking=b, gross_kes=1000, commission_rate_percent=10)
            made.append(b.pk)
        return made

    def test_dry_run_changes_nothing_and_yes_keeps_newest(self):
        ids = self.make_past(5)  # ids[0] newest ... ids[4] oldest
        self.assertIn("Dry run", self.run_cmd("--keep", "2"))
        self.assertEqual(Booking.objects.count(), 5)
        self.run_cmd("--keep", "2", "--yes")
        self.assertEqual(set(Booking.objects.values_list("pk", flat=True)), set(ids[:2]))
        self.assertEqual(Payout.objects.count(), 2)

    def test_future_bookings_are_never_deleted(self):
        future = self.booking(Booking.Status.CONFIRMED)
        self.make_past(2)
        self.run_cmd("--keep", "0", "--yes")
        self.assertEqual(list(Booking.objects.values_list("pk", flat=True)), [future.pk])

    @override_settings(PAYSTACK_SECRET_KEY="sk_live_abc")
    def test_refuses_with_live_key(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            self.run_cmd("--yes")
