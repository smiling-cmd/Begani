import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.text import slugify

from resources.models import Resource, ResourceCategory

# frontend/src/assets/audio, three folders up from backend/resources/management/commands
DEFAULT_SOURCE = Path(__file__).resolve().parents[4] / "frontend" / "src" / "assets" / "audio"

SLEEP = "Sleep & Student Wellbeing"
CALM = "Anxiety & Overthinking"
REST = "Burnout & Emotional Exhaustion"

# file name -> (title, topic, one-line summary). Anything not listed here is skipped, which also leaves
# out the "(1)" duplicates and the clips that are only a few seconds long.
CATALOG = {
    "FreeMindfulness3MinuteBreathing.mp3": ("3-minute breathing space", CALM, "A short guided pause to settle your breathing when your mind is racing.", True),
    "LifeHappens5MinuteBreathing.mp3": ("5-minute breathing meditation", CALM, "A guided breathing practice for when life feels like a lot.", True),
    "VidyamalaBreathingSpace.mp3": ("Breathing space", CALM, "A guided breathing space to step out of the rush and back into the moment.", True),
    "dragon-studio-relaxing-rain-444802.mp3": ("Relaxing rain (12 minutes)", SLEEP, "A long, steady rain to help you wind down or fall asleep.", False),
    "liecio-calming-rain-257596.mp3": ("Calming rain", SLEEP, "Soft rain on repeat. Good for studying or settling at night.", False),
    "liecio-light-rain-109591.mp3": ("Light rain", SLEEP, "A light, steady drizzle.", False),
    "universfield-soft-rain-atmosphere-454683.mp3": ("Soft rain atmosphere", SLEEP, "Gentle rain with a calm, spacious feel.", False),
    "universfield-gentle-rain-and-birds-454687.mp3": ("Gentle rain and birds", SLEEP, "Quiet rain with birdsong in the background.", False),
    "mixkit-jungle-rain-and-birds-2392.wav": ("Jungle rain and birds", SLEEP, "Warm rain falling on leaves, with birds calling nearby.", False),
    "mixkit-light-rain-loop-2393.wav": ("Light rain loop", SLEEP, "A short rain loop that repeats smoothly.", False),
    "mixkit-european-forest-ambience-1213.wav": ("Forest ambience", SLEEP, "A peaceful forest with a light breeze and birds.", False),
    "mixkit-morning-birds-2472.wav": ("Morning birds", REST, "An unhurried morning of birdsong to start the day softly.", False),
    "mixkit-natural-ambience-with-flowing-water-and-birds-61.wav": ("Flowing water and birds", SLEEP, "A stream running quietly with birds nearby.", False),
    "mixkit-night-crickets-near-the-swamp-1782.wav": ("Night crickets", SLEEP, "Crickets and night air, for winding down in the evening.", False),
    "mixkit-crickets-and-insects-in-the-wild-ambience-39.wav": ("Evening insects", SLEEP, "Crickets and insects as the day cools down.", False),
    "mixkit-small-waves-harbor-rocks-1208.wav": ("Gentle ocean waves", SLEEP, "Small waves lapping against harbour rocks.", False),
    "51604229-gentle-nature-background-497439.mp3": ("Gentle nature background", REST, "Soft nature sounds to keep in the background.", False),
    "fronbondi_skegs-pad-far-from-home-lonely-ambient-background-track-452818.mp3": ("Far from home (ambient)", REST, "A slow ambient track for focus, rest or a quiet moment.", False),
    "gigidelaromusic-deep-calm-texture-short-450960.mp3": ("Deep calm texture", REST, "A warm, slow texture to help you unwind.", False),
    "meditativetiger-ethereal-canopy-meditation-501353.mp3": ("Ethereal canopy", REST, "Airy meditation music to sit quietly with.", False),
    "soundreality-fluorescent-forest-ambient-536763.mp3": ("Fluorescent forest", REST, "A floating ambient piece with a gentle glow to it.", False),
    "softsuicide-the-last-piano-112677.mp3": ("The last piano", REST, "A soft solo piano for slowing down.", False),
    "kalsstockmedia-short-soothing-strings-guitar-music-324302.mp3": ("Soothing strings and guitar", REST, "Strings and guitar, unhurried and warm.", False),
    "kaazoom-thoughtful-30-sec-edit-relaxing-guitar-music-511742.mp3": ("Thoughtful guitar", REST, "A reflective guitar piece.", False),
    "idoberg-relaxing-guitar-loop-v9-252352.mp3": ("Relaxing guitar loop", REST, "A short guitar loop that repeats smoothly.", False),
}


def transcode(source, target, bitrate):
    """Write a smaller mono-or-stereo mp3. Returns False when ffmpeg is not installed."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    subprocess.run(
        [ffmpeg, "-loglevel", "error", "-y", "-i", str(source), "-vn", "-codec:a", "libmp3lame", "-b:a", bitrate, str(target)],
        check=True,
    )
    return True


class Command(BaseCommand):
    help = "Add the audio files in frontend/src/assets/audio to the Resources library (safe to run more than once)."

    def add_arguments(self, parser):
        parser.add_argument("--source", default=str(DEFAULT_SOURCE), help="Folder that holds the audio files.")
        parser.add_argument("--bitrate", default="96k", help="mp3 bitrate used when compressing (default 96k).")
        parser.add_argument(
            "--publish",
            action="store_true",
            help="Publish ambient sounds to students now. Guided voice tracks stay 'Pending review' until you check the licence and wording.",
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        if not source.is_dir():
            raise CommandError(f"Audio folder not found: {source}")

        created = updated = skipped = 0
        with tempfile.TemporaryDirectory() as tmp:
            for filename, (title, topic, summary, guided) in CATALOG.items():
                path = source / filename
                if not path.is_file():
                    self.stdout.write(self.style.WARNING(f"Missing, skipped: {filename}"))
                    skipped += 1
                    continue

                slug = slugify(title)
                target = Path(tmp) / f"{slug}.mp3"
                if not transcode(path, target, options["bitrate"]):
                    if path.suffix.lower() != ".mp3":
                        self.stdout.write(self.style.WARNING(f"ffmpeg not found, so {filename} was skipped (wav is too large to store)."))
                        skipped += 1
                        continue
                    shutil.copyfile(path, target)

                category, _ = ResourceCategory.objects.get_or_create(slug=slugify(topic), defaults={"name": topic})
                if options["publish"] and not guided:
                    status = Resource.Status.PUBLISHED
                else:
                    status = Resource.Status.PENDING_REVIEW

                resource, was_created = Resource.objects.get_or_create(
                    title=title,
                    type=Resource.Type.AUDIO,
                    defaults={"category": category, "summary": summary, "status": status},
                )
                resource.category = category
                resource.summary = summary
                resource.status = status
                if status == Resource.Status.PUBLISHED and not resource.published_at:
                    resource.published_at = timezone.now()
                if resource.audio_file:
                    resource.audio_file.delete(save=False)
                with target.open("rb") as handle:
                    resource.audio_file.save(f"{slug}.mp3", File(handle), save=False)
                resource.save()
                created += was_created
                updated += not was_created
                self.stdout.write(f"{'Added' if was_created else 'Updated'}: {title} ({target.stat().st_size // 1024} KB)")

        self.stdout.write(self.style.SUCCESS(f"Done. {created} added, {updated} updated, {skipped} skipped."))
        if not options["publish"]:
            self.stdout.write("They are 'Pending review'. Run again with --publish to show the ambient sounds to students.")
