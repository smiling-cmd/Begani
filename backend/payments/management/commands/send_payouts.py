from django.core.management.base import BaseCommand

from payments import services


class Command(BaseCommand):
    help = "Send every pending payout for completed sessions (retries failures; respects the daily cap and pause)."

    def handle(self, *args, **options):
        if not services.auto_payouts_active():
            self.stdout.write("Automatic payouts are off or paused; nothing sent.")
            return
        sent = services.run_auto_payouts()
        self.stdout.write(f"{len(sent)} payout(s) started.")
