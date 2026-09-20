"""Import a bundle written by `export_study_items`.

Rows are matched on their UUID, so running this twice updates rather than
duplicates, and an item keeps the identity it had on the deployment it came
from. Images are copied into this instance's MEDIA_ROOT under the same relative
path the row records, so the database and the disk still agree.

The account is matched by username, not by id: user ids differ between
deployments. `--user` overrides the name recorded in the bundle, for landing
someone else's export on your own account.
"""

import json
import os
import shutil

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from tracker.models import StudyItem

from .export_study_items import FIELDS, IMAGE_FIELDS


class Command(BaseCommand):
    help = "Import study items and their images from a bundle."

    def add_arguments(self, parser):
        parser.add_argument(
            "--from", dest="source", required=True, help="The bundle directory."
        )
        parser.add_argument(
            "--user",
            help="Land every item on this account, whatever the bundle says.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change and write nothing.",
        )

    def handle(self, *args, **options):
        source = options["source"]
        manifest = os.path.join(source, "study_items.json")
        if not os.path.exists(manifest):
            raise CommandError(f"No study_items.json in {source!r} — is that a bundle?")

        with open(manifest, encoding="utf-8") as handle:
            rows = json.load(handle)

        override = self._resolve_override(options["user"])
        dry_run = options["dry_run"]

        created = updated = images = 0
        for row in rows:
            user = override or self._resolve_user(row.get("username"))

            if dry_run:
                exists = StudyItem.objects.filter(id=row["id"]).exists()
                self.stdout.write(
                    f"  would {'update' if exists else 'create'} {row['id']} "
                    f"({row.get('prompt', '')[:40]!r}) for {user.username!r}"
                )
                continue

            defaults = {field: row[field] for field in FIELDS if field != "id" and field in row}
            defaults["user"] = user
            # created_at is auto_now_add; assigning it on create is ignored, so
            # it is restored with an explicit update below.
            created_at = defaults.pop("created_at", None)

            item, was_created = StudyItem.objects.update_or_create(
                id=row["id"], defaults=defaults
            )
            if created_at:
                StudyItem.objects.filter(pk=item.pk).update(created_at=created_at)

            for field in IMAGE_FIELDS:
                name = row.get(field)
                if name and self._restore_image(source, name):
                    setattr(item, field, name)
                    images += 1
            item.save(update_fields=IMAGE_FIELDS)

            created += int(was_created)
            updated += int(not was_created)

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Dry run: {len(rows)} items in the bundle."))
            return

        self.stdout.write(
            self.style.SUCCESS(f"Imported {created} new and {updated} existing study items.")
        )
        self.stdout.write(f"  images restored: {images}")

    def _resolve_override(self, username):
        if not username:
            return None
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"No account named {username!r} on this instance.")

    def _resolve_user(self, username):
        if not username:
            raise CommandError("A row has no username and --user was not given.")
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(
                f"The bundle expects an account named {username!r}, which does not "
                f"exist here. Create it, or pass --user to redirect the import."
            )

    def _restore_image(self, source, name):
        """Copy one image into MEDIA_ROOT. True if it was in the bundle."""
        origin = os.path.join(source, "media", name)
        if not os.path.exists(origin):
            self.stdout.write(self.style.WARNING(f"  image missing from bundle: {name}"))
            return False

        destination = os.path.join(settings.MEDIA_ROOT, name)
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(origin, destination)
        return True
