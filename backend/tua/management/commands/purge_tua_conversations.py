from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tua.models import TuaConversation


class Command(BaseCommand):
    help = "Delete TUA conversations that were not saved and have been inactive."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Delete unsaved conversations inactive for this many days (default: 90).",
        )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=options["days"])
        conversations = TuaConversation.objects.filter(
            saved=False,
            last_message_at__lt=cutoff,
        )
        count = conversations.count()
        conversations.delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {count} unsaved TUA conversation(s).")
        )
