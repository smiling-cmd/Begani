import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from resources.models import Resource, ResourceCategory, ResourceReference

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "articles.json"
YEAR = re.compile(r"\((?:(\d{4})[a-z]?(?:,[^)]*)?|n\.d\.)\)")
URL = re.compile(r"https?://\S+")


def parse_reference(text, order):
    """Best-effort structured fields from an APA 7 string; apa_text stays the source of truth."""
    text = text.strip()
    year_match = YEAR.search(text)
    year = int(year_match.group(1)) if year_match and year_match.group(1) else None
    author = text[: year_match.start()].strip() if year_match else text.split(".")[0]
    author = author.rstrip(".").strip() + ("." if re.search(r"\b[A-Z]$", author.rstrip(".").strip()) else "")
    after = text[year_match.end():].lstrip(". ").strip() if year_match else text
    url_match = URL.search(after)
    url = url_match.group(0).rstrip(".") if url_match else ""
    after = after.replace(url, "").strip() if url else after
    parts = [p.strip() for p in re.split(r"(?<=[a-z0-9])\.\s+|(?<=[?!])\s+", after) if p.strip()]
    title = (parts[0] if parts else after or text).rstrip(".")
    publication = parts[1].rstrip(".") if len(parts) > 1 else ""
    doi = ""
    if "doi.org/" in url:
        doi = url.split("doi.org/", 1)[1]
        url = ""
    return {
        "author": author[:200] or "Unknown",
        "year": year,
        "title": title[:300] or text[:300],
        "publication": publication[:300],
        "url": url[:200],
        "doi": doi[:100],
        "apa_text": text,
        "order": order,
    }


class Command(BaseCommand):
    help = "Load the BEGANI wellbeing article library (safe to run more than once)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--publish",
            action="store_true",
            help="Publish the articles to students now. Without it they are saved as 'Pending review'.",
        )

    def handle(self, *args, **options):
        articles = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        status = Resource.Status.PUBLISHED if options["publish"] else Resource.Status.PENDING_REVIEW
        created = updated = 0

        for item in articles:
            category, _ = ResourceCategory.objects.get_or_create(
                slug=slugify(item["category"]), defaults={"name": item["category"]}
            )
            resource, was_created = Resource.objects.get_or_create(
                title=item["title"],
                type=Resource.Type.ARTICLE,
                defaults={"category": category},
            )
            resource.category = category
            resource.summary = item["content"].split("\n\n")[0][:280].rsplit(" ", 1)[0] + "…"
            resource.body = item["content"]
            resource.language = "en"
            resource.author_display = item.get("author", "BEGANI Editorial Team")
            resource.reviewed_by = item.get("reviewed_by", "")
            resource.status = status
            if status == Resource.Status.PUBLISHED and not resource.published_at:
                resource.published_at = timezone.now()
            resource.save()

            resource.references.all().delete()
            for order, line in enumerate(l for l in item["references"].split("\n") if l.strip()):
                ResourceReference.objects.create(resource=resource, **parse_reference(line, order))

            created += was_created
            updated += not was_created

        label = "published" if options["publish"] else "pending review"
        self.stdout.write(self.style.SUCCESS(f"{created} created, {updated} updated ({label})."))
