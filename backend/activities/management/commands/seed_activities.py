"""Add a starter set of wellbeing activities (some free, some paid).

Run:  python manage.py seed_activities
Safe to run again: activities are matched by title, so nothing is duplicated.
Dates are set relative to today, so run it again later to refresh upcoming dates
with --refresh-dates. Fees are starting values; edit them in the admin page.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.utils import timezone

from activities.models import Activity

NAIROBI = ZoneInfo("Africa/Nairobi")
T = Activity.Type

# (title, type, weekday 0=Mon, weeks ahead, start hour, minutes, location, capacity, fee KES, description)
CATALOG = [
    ("Sunrise Campus Walk", T.MINDFULNESS, 2, 1, 6, 60, "JKUAT main gate, Juja", 40, 0,
     "A slow, quiet walk around campus before classes. No pace to keep, no talking required."),
    ("Picnic on the Lawn", T.PICNIC, 5, 1, 13, 120, "JKUAT main campus lawn", 60, 0,
     "Bring a blanket and a snack to share. Games, music and good company, with no pressure to perform."),
    ("Share the Load Circle", T.GROUP_TALK, 3, 1, 17, 90, "Counselling centre, JKUAT", 25, 0,
     "A small, facilitated group where students talk about stress and support each other. Everything said stays in the room."),
    ("Yoga and Stretch on the Field", T.YOGA, 4, 1, 17, 60, "JKUAT sports field", 30, 0,
     "Gentle stretching and breathing. Suitable for beginners. Bring a mat or a kanga."),
    ("Open Mic and Music Circle", T.MUSIC, 4, 2, 18, 120, "Student centre, JKUAT", 50, 0,
     "Sing, play or just listen. A relaxed evening to unwind with music."),
    ("Paint to Unwind", T.PAINTING, 6, 1, 14, 150, "Art room, JKUAT", 20, 500,
     "Relaxed painting afternoon. No experience needed. The fee covers canvas, paints and brushes."),
    ("Ngong Hills Day Hike", T.HIKING, 5, 2, 6, 420, "Ngong Hills, Kajiado (meet at JKUAT gate)", 35, 1200,
     "A guided ridge hike with views over the Rift Valley. The fee covers transport and a guide. Bring water and a snack."),
    ("Karura Forest Picnic Day", T.PICNIC, 6, 2, 9, 360, "Karura Forest, Nairobi", 40, 800,
     "A day in the forest: easy trails, a shared picnic and time to switch off. The fee covers transport and entry."),
    ("Lake Naivasha Wellbeing Trip", T.TRIP, 5, 4, 6, 600, "Lake Naivasha (depart from JKUAT)", 45, 2500,
     "A full-day trip with a lakeside walk, boat time and a group lunch. A proper break from exams."),
    ("Reading Club: Short Stories", T.READING_CLUB, 3, 2, 16, 75, "Library seminar room, JKUAT", 20, 0,
     "Read a short story together and talk about it. Fiction and poetry, no homework."),
]


def next_date(weekday, weeks_ahead, hour):
    today = timezone.now().astimezone(NAIROBI).date()
    days = (weekday - today.weekday()) % 7 + 7 * (weeks_ahead - 1)
    if days == 0:
        days = 7
    day = today + timedelta(days=days)
    return datetime.combine(day, time(hour, 0), tzinfo=NAIROBI)


class Command(BaseCommand):
    help = "Add starter wellbeing activities (some free, some paid). Safe to run again."

    def add_arguments(self, parser):
        parser.add_argument("--refresh-dates", action="store_true", help="Move existing seeded activities to the next upcoming dates.")

    def handle(self, *args, **options):
        created = updated = 0
        for title, kind, weekday, weeks, hour, minutes, place, capacity, fee, description in CATALOG:
            starts_at = next_date(weekday, weeks, hour)
            activity, was_created = Activity.objects.get_or_create(
                title=title,
                defaults=dict(
                    type=kind, description=description, starts_at=starts_at, duration_minutes=minutes,
                    location_text=place, capacity=capacity, fee_kes=fee, status=Activity.Status.PUBLISHED,
                ),
            )
            if was_created:
                created += 1
            elif options["refresh_dates"]:
                activity.starts_at = starts_at
                activity.save(update_fields=["starts_at"])
                updated += 1
        free = sum(1 for row in CATALOG if row[8] == 0)
        self.stdout.write(self.style.SUCCESS(
            f"{created} added, {updated} dates refreshed. Catalog: {free} free, {len(CATALOG) - free} paid."
        ))
