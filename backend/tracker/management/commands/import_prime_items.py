import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tracker.models import PrimeItem


User = get_user_model()


class Command(BaseCommand):
    help = "Import ONLY primeItems from JSON export file (preserves UUIDs, supports attachments wrapper)"

    def add_arguments(self, parser):
        parser.add_argument("json_file", type=str, help="Path to the JSON export file")
        parser.add_argument("--user", type=str, required=True, help="Username to assign imported data to")
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip items that already exist (by ID) instead of updating them",
        )

    def _load_json(self, json_path: Path) -> dict:
        try:
            with json_path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON in {json_path}: {e}") from e

    def _unwrap_export(self, data: dict) -> dict:
        if not isinstance(data, dict):
            raise CommandError("Top-level JSON must be an object/dict")

        if "primeItems" in data:
            return data

        attachments = data.get("attachments")
        if isinstance(attachments, list):
            for att in attachments:
                if not isinstance(att, dict):
                    continue
                content = att.get("content")
                if isinstance(content, dict) and "primeItems" in content:
                    return content

        raise CommandError("Could not find 'primeItems' in JSON (top-level or attachments[...].content).")

    def _parse_dt(self, value):
        if value is None:
            return None

        if isinstance(value, (int, float)):
            tz = getattr(timezone, "UTC", None)
            if tz is None:
                from datetime import timezone as dt_timezone
                tz = dt_timezone.utc
            return timezone.datetime.fromtimestamp(value / 1000, tz=tz)

        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            dt = parse_datetime(s)
            if dt is None:
                raise CommandError(f"Unparseable datetime string: {value!r}")
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt

        raise CommandError(f"Unsupported datetime value type: {type(value).__name__}")

    def _apply_created_at(self, pk, created_at_raw):
        created_at = self._parse_dt(created_at_raw)
        if created_at is None:
            return
        PrimeItem.objects.filter(pk=pk).update(created_at=created_at)

    def handle(self, *args, **options):
        json_path = Path(options["json_file"]).expanduser().resolve()
        username = options["user"]
        skip_existing = options["skip_existing"]

        if not json_path.exists():
            raise CommandError(f"File not found: {json_path}")

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as e:
            raise CommandError(f"User not found: {username}") from e

        raw = self._load_json(json_path)
        data = self._unwrap_export(raw)
        items = data.get("primeItems", [])

        created = updated = skipped = 0

        with transaction.atomic():
            for item in items:
                prime_id = item.get("id")
                if not prime_id:
                    skipped += 1
                    continue

                if skip_existing and PrimeItem.objects.filter(id=prime_id).exists():
                    skipped += 1
                    continue

                title = (item.get("title") or "").strip() or "Untitled"

                obj, was_created = PrimeItem.objects.update_or_create(
                    id=prime_id,
                    defaults={
                        "user": user,
                        "title": title[:1000],
                        "description": item.get("description", "") or "",
                        "category": item.get("category", "") or "",
                        "prime_timestamps": item.get("primeTimestamps", []) or [],
                        "archived": bool(item.get("archived", False)),
                    },
                )
                self._apply_created_at(obj.pk, item.get("createdAt"))

                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS("PrimeItem import completed:"))
        self.stdout.write(f"  primeItems: {created} created, {updated} updated, {skipped} skipped")
