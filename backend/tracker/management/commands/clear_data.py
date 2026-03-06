"""
Django management command to wipe all tracker data from the database.
Preserves user accounts by default.

Usage:
    python manage.py clear_data
    python manage.py clear_data --include-users   # also deletes all users
    python manage.py clear_data --yes             # skip confirmation prompt
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from tracker.models import (
    Project,
    Task,
    ActiveTimer,
    TimeEntry,
    Moment,
    Habit,
    StudyItem,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Delete all tracker data from the database (preserves users by default)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--include-users",
            action="store_true",
            help="Also delete all user accounts",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip confirmation prompt",
        )

    def handle(self, *args, **options):
        include_users = options["include_users"]
        skip_confirm = options["yes"]

        if not skip_confirm:
            target = (
                "ALL tracker data and ALL user accounts"
                if include_users
                else "ALL tracker data (user accounts will be kept)"
            )
            self.stdout.write(self.style.WARNING(f"\nThis will permanently delete {target}."))
            confirm = input("Type YES to continue: ")
            if confirm.strip() != "YES":
                self.stdout.write(self.style.WARNING("Aborted."))
                return

        models = [
            ("ActiveTimer",  ActiveTimer),
            ("TimeEntry",    TimeEntry),
            ("Task",         Task),
            ("Project",      Project),
            ("Moment",       Moment),
            ("Habit",        Habit),
            ("StudyItem",    StudyItem),
        ]

        for label, Model in models:
            count, _ = Model.objects.all().delete()
            self.stdout.write(f"  Deleted {count:>6} {label} rows")

        if include_users:
            count, _ = User.objects.all().delete()
            self.stdout.write(f"  Deleted {count:>6} User rows")

        self.stdout.write(self.style.SUCCESS("\nDatabase cleared successfully."))
