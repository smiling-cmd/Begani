from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from bookings.models import Booking
from payments.models import LedgerEntry, Payment, Payout, Refund


class Command(BaseCommand):
    help = (
        "Delete past bookings except the newest N (default 500), together with their payments, "
        "refunds, payouts and ledger entries. Test data cleanup only. Dry run unless --yes is given."
    )

    def add_arguments(self, parser):
        parser.add_argument("--keep", type=int, default=500, help="How many of the most recent past bookings to keep.")
        parser.add_argument("--yes", action="store_true", help="Actually delete. Without it nothing changes.")

    def handle(self, *args, keep, yes, **options):
        if keep < 0:
            raise CommandError("--keep must be 0 or more.")
        if str(getattr(settings, "PAYSTACK_SECRET_KEY", "")).startswith("sk_live"):
            raise CommandError("A live Paystack key is configured. Refusing: this would erase real payment records.")

        past = Booking.objects.filter(starts_at__lt=timezone.now()).order_by("-starts_at", "-pk")
        keep_ids = list(past.values_list("pk", flat=True)[:keep])
        doomed = Booking.objects.filter(starts_at__lt=timezone.now()).exclude(pk__in=keep_ids)

        counts = {
            "bookings": doomed.count(),
            "payments": Payment.objects.filter(booking__in=doomed).count(),
            "refunds": Refund.objects.filter(booking__in=doomed).count(),
            "payouts": Payout.objects.filter(booking__in=doomed).count(),
            "ledger entries": LedgerEntry.objects.filter(booking__in=doomed).count(),
        }
        summary = ", ".join(f"{n} {label}" for label, n in counts.items())
        if not yes:
            self.stdout.write(f"Dry run. Would delete: {summary}. Keeping the newest {len(keep_ids)} past bookings.")
            self.stdout.write("Run again with --yes to delete.")
            return

        with transaction.atomic():
            Refund.objects.filter(booking__in=doomed).delete()
            Refund.objects.filter(payment__booking__in=doomed).delete()
            LedgerEntry.objects.filter(booking__in=doomed).delete()
            Payout.objects.filter(booking__in=doomed).delete()
            Payment.objects.filter(booking__in=doomed).delete()
            doomed.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted: {summary}."))
