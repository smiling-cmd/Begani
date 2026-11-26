"""Try Daraja from the command line (no app needed):

    python manage.py daraja_try token
    python manage.py daraja_try push --phone 0712345678 --amount 1
    python manage.py daraja_try query --checkout-id ws_CO_...
"""
import json

from django.core.management.base import BaseCommand, CommandError

from payments import daraja


class Command(BaseCommand):
    help = "Call Daraja directly to learn/debug: token, push (STK prompt), query."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["token", "push", "query"])
        parser.add_argument("--phone")
        parser.add_argument("--amount", type=int, default=1)
        parser.add_argument("--checkout-id")

    def handle(self, *args, action, phone, amount, checkout_id, **_options):
        try:
            if action == "token":
                token = daraja.get_token()
                self.stdout.write(self.style.SUCCESS(f"OK, got an access token ({token[:6]}…, env={daraja.base_url()})"))
            elif action == "push":
                number = daraja.normalize_phone(phone or "")
                if not number:
                    raise CommandError("Give a valid --phone like 0712345678")
                data = daraja.stk_push(phone=number, amount_kes=amount, reference="manual")
                self.stdout.write(json.dumps(data, indent=2))
                self.stdout.write("Now run: daraja_try query --checkout-id " + data["checkout_request_id"])
            else:
                if not checkout_id:
                    raise CommandError("Give --checkout-id")
                self.stdout.write(json.dumps(daraja.stk_query(checkout_id), indent=2))
        except daraja.DarajaError as exc:
            raise CommandError(str(exc))
