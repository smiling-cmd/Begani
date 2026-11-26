from django.core.management.base import BaseCommand, CommandError

from payments import paystack


class Command(BaseCommand):
    help = (
        "Turn off Paystack's OTP confirmation for transfers, so payouts can send automatically.\n"
        "Step 1: run with no arguments (Paystack sends a code to the account owner).\n"
        "Step 2: run again with --otp CODE."
    )

    def add_arguments(self, parser):
        parser.add_argument("--otp", help="The code Paystack sent after step 1.")

    def handle(self, *args, otp=None, **options):
        try:
            if otp:
                message = paystack.finalize_disable_transfer_otp(otp.strip())
                self.stdout.write(self.style.SUCCESS(message or "Transfer OTP is now disabled."))
            else:
                message = paystack.disable_transfer_otp()
                self.stdout.write(message or "Paystack sent a code to the account owner.")
                self.stdout.write("Now run: python manage.py disable_transfer_otp --otp CODE")
        except paystack.PaystackError as exc:
            raise CommandError(str(exc))
