"""Export study items — rows *and* the image files they point at.

`backup_data` writes the database only. An ImageField stores a path, never the
bytes, so a restore from that backup leaves intact-looking rows whose images
404. This writes a self-contained bundle:

    <out>/study_items.json
    <out>/media/study_item_images/<user id>/<file>

Run it wherever the files are. When the database is remote but the files are
not — pointing a local Django at a production DATABASE_URL, say — pass
`--media-base https://the-host` and the images are fetched over HTTPS from the
site's own /media/ URLs instead of the local disk.
"""

import json
import os
import shutil
import uuid
from urllib.parse import urljoin
from urllib.request import urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from tracker.models import StudyItem

# Everything worth carrying: the content, the history, and the flags that
# decide which mode an item is in.
FIELDS = [
    "id",
    "prompt",
    "notes",
    "category",
    "is_priming",
    "is_studying",
    "is_reviewing",
    "is_archived",
    "prime_count",
    "study_count",
    "review_count",
    "prime_timestamps",
    "study_timestamps",
    "review_timestamps",
    "first_primed_at",
    "last_primed_at",
    "first_studied_at",
    "last_studied_at",
    "first_reviewed_at",
    "last_reviewed_at",
    "created_at",
]

IMAGE_FIELDS = ["image", "note_image"]


class Command(BaseCommand):
    help = "Export study items and their images into a portable bundle."

    def add_arguments(self, parser):
        parser.add_argument("--out", required=True, help="Directory to write the bundle into.")
        parser.add_argument(
            "--user",
            help="Only this account's items (username). Defaults to every account.",
        )
        parser.add_argument(
            "--media-base",
            help=(
                "Fetch images over HTTP from this origin instead of the local "
                "disk, e.g. https://bitadam.net. Use when the database is "
                "remote and its media directory is not reachable."
            ),
        )

    def handle(self, *args, **options):
        out = options["out"]
        media_base = options["media_base"]
        os.makedirs(out, exist_ok=True)

        items = StudyItem.objects.all().order_by("created_at")
        if options["user"]:
            items = items.filter(user__username=options["user"])
            if not items.exists():
                raise CommandError(f"No study items found for user {options['user']!r}.")

        rows = []
        copied = 0
        missing = []

        for item in items:
            row = {field: self._serialize(getattr(item, field)) for field in FIELDS}
            row["username"] = item.user.username if item.user else None

            for field in IMAGE_FIELDS:
                stored = getattr(item, field)
                row[field] = stored.name if stored else None
                if not stored:
                    continue
                if self._collect(stored.name, out, media_base):
                    copied += 1
                else:
                    missing.append(stored.name)

            rows.append(row)

        with open(os.path.join(out, "study_items.json"), "w", encoding="utf-8") as handle:
            json.dump(rows, handle, indent=2, ensure_ascii=False)

        self.stdout.write(self.style.SUCCESS(f"Exported {len(rows)} study items to {out}"))
        self.stdout.write(f"  images copied: {copied}")
        if missing:
            # Worth shouting about: these rows will import with a broken image.
            self.stdout.write(
                self.style.WARNING(f"  images NOT found ({len(missing)}): {', '.join(missing)}")
            )

    @staticmethod
    def _serialize(value):
        """JSON-safe: UUIDs and datetimes both become strings."""
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

    def _collect(self, name, out, media_base):
        """Put one image into the bundle. True if it was found."""
        destination = os.path.join(out, "media", name)
        os.makedirs(os.path.dirname(destination), exist_ok=True)

        source = os.path.join(settings.MEDIA_ROOT, name)
        if os.path.exists(source):
            shutil.copy2(source, destination)
            return True

        if not media_base:
            return False

        url = urljoin(media_base.rstrip("/") + "/", f"{settings.MEDIA_URL.lstrip('/')}{name}")
        try:
            with urlopen(url, timeout=30) as response, open(destination, "wb") as handle:
                shutil.copyfileobj(response, handle)
            return True
        except Exception as error:  # network, 404, permissions — all the same here
            self.stdout.write(self.style.WARNING(f"  could not fetch {url}: {error}"))
            if os.path.exists(destination):
                os.remove(destination)
            return False
