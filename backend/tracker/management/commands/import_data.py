"""
Django management command to import data from a JSON export file.

Features:
* Preserves UUID primary keys from the export file (id fields).
* Assigns imported objects to a specified user.
* Optionally skips existing objects (by id) instead of updating.
* Optionally creates placeholder Tasks for TimeEntries referencing missing tasks.
* Optional per-item logging + periodic progress heartbeats.

Usage:
    PYTHONUNBUFFERED=1 python manage.py import_data /path/to/export.json --user <username> --verbose-items
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tracker.models import Project, Task, TimeEntry, Moment, PrimeItem, ReviewItem

User = get_user_model()


class Command(BaseCommand):
    help = "Import data from JSON export file, preserving UUIDs"

    def add_arguments(self, parser):
        parser.add_argument("json_file", type=str, help="Path to JSON file")
        parser.add_argument("--user", type=str, required=True, help="Username to own imported data")

        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip objects that already exist by ID (instead of updating them)",
        )

        parser.add_argument(
            "--create-missing-tasks",
            action="store_true",
            help="Create placeholder tasks for timeEntries whose taskId isn't in tasks",
        )

        parser.add_argument(
            "--verbose-items",
            action="store_true",
            help="Print a line for each item created/updated/skipped",
        )

        parser.add_argument(
            "--progress-every",
            type=int,
            default=200,
            help="Print a progress heartbeat every N items per section (0 disables)",
        )

    # ---------- logging helpers ----------
    def _log_item(self, verbose, model_name, obj_id, status, extra=""):
        if not verbose:
            return
        suffix = f" | {extra}" if extra else ""
        self.stdout.write(f"{model_name} {status}: {obj_id}{suffix}")

    def _heartbeat(self, every, model_name, i, total=None):
        if not every or every <= 0:
            return
        if i % every != 0:
            return
        if total is None:
            self.stdout.write(f"{model_name} progress: {i}")
        else:
            self.stdout.write(f"{model_name} progress: {i}/{total}")

    # ---------- datetime parsing ----------
    def _parse_dt(self, value):
        """
        Accepts:
        * None
        * ISO string (e.g. '2026-01-19T18:43:56.794Z')
        * ms epoch number (e.g. 1768682809892)
        Returns an aware datetime or None.
        """
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

    def _exists(self, Model, obj_id):
        return Model.objects.filter(id=obj_id).exists()

    def _apply_created_at(self, Model, pk, created_at_raw):
        created_at = self._parse_dt(created_at_raw)
        if created_at is None:
            return
        # auto_now_add=True prevents setting created_at on create via defaults;
        # update it after creation/update to preserve export timestamps.
        Model.objects.filter(pk=pk).update(created_at=created_at)

    # ---------- importers ----------
    def import_projects(self, items, user, skip_existing, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "Project", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "Project", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(Project, obj_id):
                skipped += 1
                self._log_item(verbose_items, "Project", obj_id, "skipped", "already exists")
                continue

            obj, was_created = Project.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "name": item.get("name") or "Untitled",
                    "description": item.get("description") or "",
                    "color": item.get("color") or "#6366f1",
                    "archived": bool(item.get("archived", False)),
                },
            )
            self._apply_created_at(Project, obj.pk, item.get("createdAt"))

            if was_created:
                created += 1
                self._log_item(verbose_items, "Project", obj_id, "created", obj.name)
            else:
                updated += 1
                self._log_item(verbose_items, "Project", obj_id, "updated", obj.name)

        return created, updated, skipped

    def import_tasks(self, items, user, skip_existing, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "Task", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "Task", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(Task, obj_id):
                skipped += 1
                self._log_item(verbose_items, "Task", obj_id, "skipped", "already exists")
                continue

            project = None
            project_id = item.get("projectId")
            if project_id:
                project = Project.objects.filter(id=project_id).first()
                if project is None:
                    msg = f"projectId {project_id} not found; importing with project=NULL"
                    self.stdout.write(self.style.WARNING(f"Task {obj_id}: {msg}"))
                    self._log_item(verbose_items, "Task", obj_id, "warning", msg)

            planned_start = self._parse_dt(item.get("plannedStart"))
            planned_duration = item.get("plannedDuration")

            title = (item.get("title") or "").strip() or "Untitled"

            obj, was_created = Task.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "title": title,
                    "category": item.get("category") or "other",
                    "project": project,
                    "notes": item.get("notes") or "",
                    "planned_start": planned_start,
                    "planned_duration": planned_duration,
                    "archived": bool(item.get("archived", False)),
                },
            )
            self._apply_created_at(Task, obj.pk, item.get("createdAt"))

            if was_created:
                created += 1
                self._log_item(verbose_items, "Task", obj_id, "created", obj.title)
            else:
                updated += 1
                self._log_item(verbose_items, "Task", obj_id, "updated", obj.title)

        return created, updated, skipped

    def import_time_entries(self, items, user, skip_existing, create_missing_tasks, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "TimeEntry", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "TimeEntry", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(TimeEntry, obj_id):
                skipped += 1
                self._log_item(verbose_items, "TimeEntry", obj_id, "skipped", "already exists")
                continue

            task_id = item.get("taskId") or item.get("task")
            if not task_id:
                skipped += 1
                msg = "missing taskId"
                self.stdout.write(self.style.WARNING(f"TimeEntry {obj_id}: {msg}; skipping"))
                self._log_item(verbose_items, "TimeEntry", obj_id, "skipped", msg)
                continue

            task = Task.objects.filter(id=task_id).first()

            if task is None and create_missing_tasks:
                placeholder_title = (item.get("taskTitle") or "").strip() or "Untitled"
                task, task_created = Task.objects.update_or_create(
                    id=task_id,
                    defaults={
                        "user": user,
                        "title": placeholder_title,
                        "category": "other",
                        "project": None,
                        "notes": "",
                        "planned_start": None,
                        "planned_duration": None,
                        "archived": False,
                    },
                )
                if task_created:
                    # keep this as a WARNING so it's visible even without --verbose-items
                    self.stdout.write(self.style.WARNING(f"Created placeholder Task {task_id} for TimeEntry {obj_id}"))
                    self._log_item(verbose_items, "Task", task_id, "created", f"placeholder for TimeEntry {obj_id}")
                else:
                    self._log_item(verbose_items, "Task", task_id, "updated", f"placeholder reused for TimeEntry {obj_id}")

            if task is None:
                skipped += 1
                msg = f"task {task_id} not found"
                self.stdout.write(self.style.WARNING(f"TimeEntry {obj_id}: {msg}; skipping"))
                self._log_item(verbose_items, "TimeEntry", obj_id, "skipped", msg)
                continue

            started_at = self._parse_dt(item.get("startedAt"))
            ended_at = self._parse_dt(item.get("endedAt"))

            if started_at is None:
                skipped += 1
                msg = "missing/invalid startedAt"
                self.stdout.write(self.style.WARNING(f"TimeEntry {obj_id}: {msg}; skipping"))
                self._log_item(verbose_items, "TimeEntry", obj_id, "skipped", msg)
                continue

            obj, was_created = TimeEntry.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "task": task,
                    "task_title": item.get("taskTitle") or task.title,
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "duration_seconds": int(item.get("durationSeconds") or 0),
                    "notes": item.get("notes") or "",
                    "breaks": item.get("breaks") or [],
                },
            )
            self._apply_created_at(TimeEntry, obj.pk, item.get("createdAt"))

            extra = item.get("taskTitle") or task.title
            if was_created:
                created += 1
                self._log_item(verbose_items, "TimeEntry", obj_id, "created", extra)
            else:
                updated += 1
                self._log_item(verbose_items, "TimeEntry", obj_id, "updated", extra)

        return created, updated, skipped

    def import_moments(self, items, user, skip_existing, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "Moment", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "Moment", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(Moment, obj_id):
                skipped += 1
                self._log_item(verbose_items, "Moment", obj_id, "skipped", "already exists")
                continue

            timestamp = self._parse_dt(item.get("timestampMs") or item.get("timestamp"))
            if timestamp is None:
                skipped += 1
                msg = "missing/invalid timestamp"
                self.stdout.write(self.style.WARNING(f"Moment {obj_id}: {msg}; skipping"))
                self._log_item(verbose_items, "Moment", obj_id, "skipped", msg)
                continue

            obj, was_created = Moment.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "description": item.get("description") or "",
                    "category": item.get("category") or "general",
                    "timestamp": timestamp,
                    "task": None,
                    "task_title": item.get("taskTitle") or "",
                    "is_milestone": bool(item.get("isMilestone", False)),
                },
            )
            self._apply_created_at(Moment, obj.pk, item.get("createdAt"))

            extra = (obj.description or "")[:60]
            if was_created:
                created += 1
                self._log_item(verbose_items, "Moment", obj_id, "created", extra)
            else:
                updated += 1
                self._log_item(verbose_items, "Moment", obj_id, "updated", extra)

        return created, updated, skipped

    def import_prime_items(self, items, user, skip_existing, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "PrimeItem", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "PrimeItem", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(PrimeItem, obj_id):
                skipped += 1
                self._log_item(verbose_items, "PrimeItem", obj_id, "skipped", "already exists")
                continue

            title = (item.get("title") or "").strip() or "Untitled"

            obj, was_created = PrimeItem.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "title": title,
                    "description": item.get("description") or "",
                    "category": item.get("category") or "",
                    "prime_timestamps": item.get("primeTimestamps") or [],
                    "archived": bool(item.get("archived", False)),
                },
            )
            self._apply_created_at(PrimeItem, obj.pk, item.get("createdAt"))

            if was_created:
                created += 1
                self._log_item(verbose_items, "PrimeItem", obj_id, "created", obj.title[:80])
            else:
                updated += 1
                self._log_item(verbose_items, "PrimeItem", obj_id, "updated", obj.title[:80])

        return created, updated, skipped

    def import_review_items(self, items, user, skip_existing, verbose_items, progress_every):
        created = updated = skipped = 0
        total = len(items)

        for idx, item in enumerate(items, start=1):
            self._heartbeat(progress_every, "ReviewItem", idx, total=total)

            obj_id = item.get("id")
            if not obj_id:
                skipped += 1
                self._log_item(verbose_items, "ReviewItem", "(missing id)", "skipped")
                continue

            if skip_existing and self._exists(ReviewItem, obj_id):
                skipped += 1
                self._log_item(verbose_items, "ReviewItem", obj_id, "skipped", "already exists")
                continue

            first_studied_at = self._parse_dt(item.get("firstStudiedAt"))

            obj, was_created = ReviewItem.objects.update_or_create(
                id=obj_id,
                defaults={
                    "user": user,
                    "title": item.get("title") or "Untitled",
                    "description": item.get("description") or "",
                    "category": item.get("category") or "",
                    "review_timestamps": item.get("reviewTimestamps") or [],
                    "first_studied_at": first_studied_at,
                    "archived": bool(item.get("archived", False)),
                },
            )
            self._apply_created_at(ReviewItem, obj.pk, item.get("createdAt"))

            if was_created:
                created += 1
                self._log_item(verbose_items, "ReviewItem", obj_id, "created", obj.title[:80])
            else:
                updated += 1
                self._log_item(verbose_items, "ReviewItem", obj_id, "updated", obj.title[:80])

        return created, updated, skipped

    # ---------- entrypoint ----------
    def handle(self, *args, **options):
        json_path = Path(options["json_file"]).expanduser().resolve()
        username = options["user"]
        skip_existing = options["skip_existing"]
        create_missing_tasks = options["create_missing_tasks"]
        verbose_items = options["verbose_items"]
        progress_every = options["progress_every"]

        if not json_path.exists():
            raise CommandError(f"File not found: {json_path}")

        user = User.objects.filter(username=username).first()
        if user is None:
            raise CommandError(f"User not found: {username}")

        data = json.loads(json_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise CommandError("Top-level JSON must be an object/dict")

        self.stdout.write(f"Loading data from: {json_path}")
        self.stdout.write(
            f"Options: skip_existing={skip_existing}, create_missing_tasks={create_missing_tasks}, "
            f"verbose_items={verbose_items}, progress_every={progress_every}"
        )

        with transaction.atomic():
            p = self.import_projects(data.get("projects", []), user, skip_existing, verbose_items, progress_every)
            t = self.import_tasks(data.get("tasks", []), user, skip_existing, verbose_items, progress_every)
            te = self.import_time_entries(
                data.get("timeEntries", []),
                user,
                skip_existing,
                create_missing_tasks,
                verbose_items,
                progress_every,
            )
            m = self.import_moments(data.get("moments", []), user, skip_existing, verbose_items, progress_every)
            pi = self.import_prime_items(data.get("primeItems", []), user, skip_existing, verbose_items, progress_every)
            ri = self.import_review_items(
                data.get("reviewItems", []), user, skip_existing, verbose_items, progress_every
            )

        self.stdout.write(self.style.SUCCESS("Import complete"))
        self.stdout.write(f"projects:    {p[0]} created, {p[1]} updated, {p[2]} skipped")
        self.stdout.write(f"tasks:       {t[0]} created, {t[1]} updated, {t[2]} skipped")
        self.stdout.write(f"timeEntries: {te[0]} created, {te[1]} updated, {te[2]} skipped")
        self.stdout.write(f"moments:     {m[0]} created, {m[1]} updated, {m[2]} skipped")
        self.stdout.write(f"primeItems:  {pi[0]} created, {pi[1]} updated, {pi[2]} skipped")
        self.stdout.write(f"reviewItems: {ri[0]} created, {ri[1]} updated, {ri[2]} skipped")
