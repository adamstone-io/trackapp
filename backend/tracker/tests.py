from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from .models import Habit, Project, StudyItem, Task, TimeEntry


class EmailLoginTests(TestCase):
    """The React login form offers "email or username" as the identifier."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2"
        )

    def test_login_with_username(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())

    def test_login_with_email(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_login_with_email_is_case_insensitive(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "Adam@Example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def test_login_with_unknown_email_fails(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "nobody@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_ambiguous_email_does_not_log_into_an_arbitrary_account(self):
        # Legacy data may hold case-variant duplicate emails; refuse to guess.
        User.objects.create_user(
            username="adam2", email="Adam@example.com", password="hunter2"
        )
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_unverified_login_message_is_stable(self):
        # The React login page redirects to /verify-email by matching this
        # message. If the copy changes, update web/src/pages/LoginPage.tsx too.
        unverified = User.objects.create_user(
            username="newbie",
            email="newbie@example.com",
            password="hunter2",
            is_active=False,
        )
        from .models import EmailVerification

        EmailVerification.objects.create(user=unverified)
        response = self.client.post(
            "/api/auth/token/",
            {"username": "newbie", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("verify your email", str(response.json()).lower())

    def test_login_with_wrong_password_fails(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "wrong"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)


class HabitApiTestCase(TestCase):
    """Habit endpoints as the habits page uses them (React rebuild ticket 04).

    State that only time can produce (yesterday's log, an old streak) is
    arranged directly on the model; every assertion goes through the HTTP API.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2"
        )
        token = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2"},
            content_type="application/json",
        ).json()["access"]
        self.headers = {"authorization": f"Bearer {token}"}

    def get_habit(self, tz="Australia/Brisbane"):
        response = self.client.get(
            "/api/habits/", headers={**self.headers, "x-user-timezone": tz}
        )
        self.assertEqual(response.status_code, 200)
        return response.json()["results"][0]

    def post_action(self, habit, action, body=None, tz="Australia/Brisbane"):
        return self.client.post(
            f"/api/habits/{habit.id}/{action}/",
            body or {},
            content_type="application/json",
            headers={**self.headers, "x-user-timezone": tz},
        )

    def today(self, tz="Australia/Brisbane"):
        import zoneinfo

        return timezone.now().astimezone(zoneinfo.ZoneInfo(tz)).date()


class HabitCounterResetTests(HabitApiTestCase):
    """R20: counters reset at day/week/month boundaries in the user's timezone."""

    def test_daily_count_reads_zero_the_day_after_it_was_logged(self):
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            daily_count=3,
            weekly_count=3,
            monthly_count=3,
            last_logged_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(self.get_habit()["daily_count"], 0)

    def test_counts_keep_their_value_within_the_same_day(self):
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_count=2,
            weekly_count=5,
            monthly_count=9,
            last_logged_at=timezone.now(),
        )
        habit = self.get_habit()
        self.assertEqual(
            (habit["daily_count"], habit["weekly_count"], habit["monthly_count"]),
            (2, 5, 9),
        )

    def test_weekly_count_reads_zero_once_a_new_week_starts(self):
        import zoneinfo
        from datetime import datetime

        tz = zoneinfo.ZoneInfo("Australia/Brisbane")
        today = timezone.now().astimezone(tz).date()
        # Noon on the Sunday before this week's Monday — always last week.
        last_sunday = today - timedelta(days=today.weekday() + 1)
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            weekly_count=5,
            last_logged_at=datetime(
                last_sunday.year, last_sunday.month, last_sunday.day, 12, tzinfo=tz
            ),
        )
        self.assertEqual(self.get_habit()["weekly_count"], 0)

    def test_monthly_count_reads_zero_once_a_new_month_starts(self):
        import zoneinfo
        from datetime import datetime

        tz = zoneinfo.ZoneInfo("Australia/Brisbane")
        today = timezone.now().astimezone(tz).date()
        last_of_prev_month = today.replace(day=1) - timedelta(days=1)
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            monthly_count=9,
            last_logged_at=datetime(
                last_of_prev_month.year,
                last_of_prev_month.month,
                last_of_prev_month.day,
                12,
                tzinfo=tz,
            ),
        )
        self.assertEqual(self.get_habit()["monthly_count"], 0)

    def test_day_boundary_follows_the_users_timezone_not_utc(self):
        import zoneinfo
        from datetime import datetime
        from unittest import mock

        utc = zoneinfo.ZoneInfo("UTC")
        # 20:00 UTC Mar 9 is already 06:00 Mar 10 in Brisbane (UTC+10).
        logged = datetime(2026, 3, 9, 20, 0, tzinfo=utc)
        frozen_now = datetime(2026, 3, 10, 1, 0, tzinfo=utc)
        Habit.objects.create(
            user=self.user, name="Meditate", daily_count=2, last_logged_at=logged
        )
        with mock.patch("django.utils.timezone.now", return_value=frozen_now):
            self.assertEqual(self.get_habit(tz="Australia/Brisbane")["daily_count"], 2)
            self.assertEqual(self.get_habit(tz="UTC")["daily_count"], 0)


class HabitStreakTests(HabitApiTestCase):
    """R21: streak counts consecutive days the daily target was met."""

    def test_streak_reads_zero_during_a_gap(self):
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            streak_count=5,
            last_completed_date=self.today() - timedelta(days=2),
            last_logged_at=timezone.now() - timedelta(days=2),
        )
        self.assertEqual(self.get_habit()["streak_count"], 0)

    def test_streak_still_reads_while_completed_yesterday(self):
        Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            streak_count=5,
            last_completed_date=self.today() - timedelta(days=1),
            last_logged_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(self.get_habit()["streak_count"], 5)

    def test_completing_on_consecutive_days_extends_the_streak(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            streak_count=4,
            last_completed_date=self.today() - timedelta(days=1),
            last_logged_at=timezone.now() - timedelta(days=1),
        )
        response = self.post_action(habit, "log")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["streak_count"], 5)

    def test_completing_after_a_gap_restarts_the_streak_at_one(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            streak_count=4,
            last_completed_date=self.today() - timedelta(days=3),
            last_logged_at=timezone.now() - timedelta(days=3),
        )
        self.assertEqual(self.post_action(habit, "log").json()["streak_count"], 1)


class HabitLogTests(HabitApiTestCase):
    """R19: one log action updates all three counters at once."""

    def test_log_increments_all_three_counters(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_count=1,
            weekly_count=4,
            monthly_count=8,
            last_logged_at=timezone.now(),
        )
        data = self.post_action(habit, "log").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (2, 5, 9),
        )


class HabitInactiveTests(HabitApiTestCase):
    """R22: logging against a paused/inactive habit has no effect."""

    def test_logging_an_inactive_habit_changes_nothing(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            is_active=False,
            daily_target=1,
            daily_count=2,
            weekly_count=2,
            monthly_count=2,
            streak_count=3,
            last_completed_date=self.today(),
            last_logged_at=timezone.now(),
        )
        self.post_action(habit, "log")
        data = self.get_habit()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"], data["streak_count"]),
            (2, 2, 2, 3),
        )


class HabitUnlogTests(HabitApiTestCase):
    """R23b: remove a mistaken log entry, reducing the counts accordingly."""

    def test_unlog_decrements_all_three_counters(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_count=2,
            weekly_count=5,
            monthly_count=9,
            last_logged_at=timezone.now(),
        )
        response = self.post_action(habit, "unlog")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (1, 4, 8),
        )

    def test_unlog_never_drops_a_counter_below_zero(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_count=0,
            weekly_count=1,
            monthly_count=1,
            last_logged_at=timezone.now(),
        )
        data = self.post_action(habit, "unlog").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (0, 0, 0),
        )

    def test_unlog_withdraws_a_streak_credit_earned_today(self):
        # Day 3 of a streak was credited by today's log; removing that log
        # leaves a 2-day streak that ended yesterday.
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            daily_count=1,
            weekly_count=3,
            monthly_count=3,
            streak_count=3,
            last_completed_date=self.today(),
            last_logged_at=timezone.now(),
        )
        data = self.post_action(habit, "unlog").json()
        self.assertEqual(data["daily_count"], 0)
        self.assertEqual(data["streak_count"], 2)

    def test_unlog_of_a_first_streak_day_clears_the_streak(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            daily_count=1,
            weekly_count=1,
            monthly_count=1,
            streak_count=1,
            last_completed_date=self.today(),
            last_logged_at=timezone.now(),
        )
        self.assertEqual(self.post_action(habit, "unlog").json()["streak_count"], 0)

    def test_unlog_keeps_the_streak_while_still_at_target(self):
        # Two logs against a target of one: removing one leaves the day met.
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            daily_target=1,
            daily_count=2,
            weekly_count=2,
            monthly_count=2,
            streak_count=4,
            last_completed_date=self.today(),
            last_logged_at=timezone.now(),
        )
        data = self.post_action(habit, "unlog").json()
        self.assertEqual(data["daily_count"], 1)
        self.assertEqual(data["streak_count"], 4)

    def test_unlog_on_an_inactive_habit_changes_nothing(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            is_active=False,
            daily_count=2,
            weekly_count=2,
            monthly_count=2,
            last_logged_at=timezone.now(),
        )
        self.post_action(habit, "unlog")
        self.assertEqual(self.get_habit()["daily_count"], 2)


class HabitBackfillTests(HabitApiTestCase):
    """R23c: log a habit entry for a past date.

    The clock is frozen at Wednesday 2026-03-11 12:00 UTC so week and month
    boundaries around the back-filled dates are deterministic. Only current
    counters exist (no per-day history), so a past log bumps the weekly and
    monthly counters when the date falls inside the current week or month,
    and never today's daily count.
    """

    FROZEN_NOW = None  # set in setUp

    def setUp(self):
        super().setUp()
        import zoneinfo
        from datetime import datetime

        self.FROZEN_NOW = datetime(2026, 3, 11, 12, 0, tzinfo=zoneinfo.ZoneInfo("UTC"))

    def frozen(self):
        from unittest import mock

        return mock.patch("django.utils.timezone.now", return_value=self.FROZEN_NOW)

    def make_habit(self, **overrides):
        fields = dict(
            user=self.user,
            name="Meditate",
            daily_count=1,
            weekly_count=3,
            monthly_count=5,
            last_logged_at=self.FROZEN_NOW,
        )
        fields.update(overrides)
        return Habit.objects.create(**fields)

    def backfill(self, habit, date, amount=1):
        with self.frozen():
            return self.post_action(habit, "log", {"date": date, "amount": amount}, tz="UTC")

    def test_backfilling_yesterday_bumps_weekly_and_monthly_but_not_daily(self):
        habit = self.make_habit()
        response = self.backfill(habit, "2026-03-10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (1, 4, 6),
        )

    def test_backfilling_a_date_in_a_previous_week_only_bumps_monthly(self):
        habit = self.make_habit()
        data = self.backfill(habit, "2026-03-04").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (1, 3, 6),
        )

    def test_backfilling_a_date_in_a_previous_month_changes_no_counters(self):
        habit = self.make_habit()
        data = self.backfill(habit, "2026-02-10").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (1, 3, 5),
        )

    def test_backfilling_a_future_date_is_rejected(self):
        habit = self.make_habit()
        response = self.backfill(habit, "2026-03-12")
        self.assertEqual(response.status_code, 400)
        self.assertIn("future", response.json()["detail"])

    def test_backfilling_a_malformed_date_is_rejected(self):
        habit = self.make_habit()
        self.assertEqual(self.backfill(habit, "next tuesday").status_code, 400)

    def test_backfilling_todays_date_logs_normally(self):
        habit = self.make_habit()
        data = self.backfill(habit, "2026-03-11").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (2, 4, 6),
        )

    def test_backfill_meeting_the_target_fills_yesterdays_gap_in_the_streak(self):
        # Today restarted the streak at 1 because yesterday was missed;
        # back-filling yesterday to target makes it two consecutive days.
        habit = self.make_habit(
            daily_target=1,
            streak_count=1,
            last_completed_date=self.FROZEN_NOW.date(),  # today, 2026-03-11
        )
        with self.frozen():
            data = self.backfill(habit, "2026-03-10").json()
        self.assertEqual(data["streak_count"], 2)

    def test_backfill_extends_a_streak_that_ended_yesterday(self):
        habit = self.make_habit(
            daily_target=1,
            streak_count=2,
            last_completed_date=self.FROZEN_NOW.date() - timedelta(days=2),  # 03-09
        )
        with self.frozen():
            data = self.backfill(habit, "2026-03-10").json()
        self.assertEqual(data["streak_count"], 3)

    def test_backfill_below_the_daily_target_earns_no_streak_credit(self):
        habit = self.make_habit(
            daily_target=2,
            streak_count=1,
            last_completed_date=self.FROZEN_NOW.date(),
        )
        with self.frozen():
            data = self.backfill(habit, "2026-03-10", amount=1).json()
        self.assertEqual(data["streak_count"], 1)

    def test_backfill_on_an_inactive_habit_changes_nothing(self):
        habit = self.make_habit(is_active=False)
        data = self.backfill(habit, "2026-03-10").json()
        self.assertEqual(
            (data["daily_count"], data["weekly_count"], data["monthly_count"]),
            (1, 3, 5),
        )


class HabitCrudTests(HabitApiTestCase):
    """R18/R23: create with three targets, edit, archive and restore."""

    def test_create_habit_with_three_targets(self):
        response = self.client.post(
            "/api/habits/",
            {"name": "Meditate", "daily_target": 1, "weekly_target": 5, "monthly_target": 20},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Meditate")
        self.assertEqual(
            (data["daily_target"], data["weekly_target"], data["monthly_target"]),
            (1, 5, 20),
        )
        self.assertEqual(data["daily_count"], 0)
        self.assertTrue(data["is_active"])

    def test_edit_name_and_targets(self):
        habit = Habit.objects.create(user=self.user, name="Meditate", daily_target=1)
        response = self.client.patch(
            f"/api/habits/{habit.id}/",
            {"name": "Meditate longer", "daily_target": 2},
            content_type="application/json",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Meditate longer")
        self.assertEqual(response.json()["daily_target"], 2)

    def test_archive_and_restore_preserve_history(self):
        habit = Habit.objects.create(
            user=self.user,
            name="Meditate",
            streak_count=7,
            last_completed_date=self.today() - timedelta(days=1),
            last_logged_at=timezone.now() - timedelta(days=1),
        )
        archived = self.client.patch(
            f"/api/habits/{habit.id}/",
            {"is_active": False},
            content_type="application/json",
            headers=self.headers,
        ).json()
        self.assertFalse(archived["is_active"])
        restored = self.client.patch(
            f"/api/habits/{habit.id}/",
            {"is_active": True},
            content_type="application/json",
            headers=self.headers,
        ).json()
        self.assertTrue(restored["is_active"])
        self.assertEqual(restored["streak_count"], 7)


class WorkspaceApiTestCase(TestCase):
    """Project/task endpoints as the workspace page uses them (ticket 05)."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2"
        )
        token = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2"},
            content_type="application/json",
        ).json()["access"]
        self.headers = {"authorization": f"Bearer {token}"}

    def entry(self, task, seconds):
        return TimeEntry.objects.create(
            user=self.user,
            task=task,
            task_title=task.title,
            started_at=timezone.now() - timedelta(seconds=seconds),
            ended_at=timezone.now(),
            duration_seconds=seconds,
        )


class ProjectTotalsTests(WorkspaceApiTestCase):
    """R18: total tracked time per project comes annotated from the backend."""

    def test_project_total_sums_time_across_all_its_tasks(self):
        project = Project.objects.create(user=self.user, name="TrackApp")
        write = Task.objects.create(user=self.user, title="Write", project=project)
        edit = Task.objects.create(user=self.user, title="Edit", project=project)
        self.entry(write, 600)
        self.entry(write, 300)
        self.entry(edit, 100)

        rows = self.client.get("/api/projects/", headers=self.headers).json()["results"]
        self.assertEqual(rows[0]["total_seconds"], 1000)

    def test_project_with_no_tracked_time_reports_zero_not_null(self):
        Project.objects.create(user=self.user, name="Empty")

        rows = self.client.get("/api/projects/", headers=self.headers).json()["results"]
        self.assertEqual(rows[0]["total_seconds"], 0)

    def test_task_with_no_tracked_time_reports_zero_not_null(self):
        Task.objects.create(user=self.user, title="Untracked")

        rows = self.client.get("/api/tasks/", headers=self.headers).json()["results"]
        self.assertEqual(rows[0]["total_seconds"], 0)


class ProjectDeleteTests(WorkspaceApiTestCase):
    """R16: deleting a project leaves its tasks (and their history) intact."""

    def test_deleting_a_project_unassigns_its_tasks(self):
        project = Project.objects.create(user=self.user, name="TrackApp")
        task = Task.objects.create(user=self.user, title="Write", project=project)
        self.entry(task, 600)

        response = self.client.delete(
            f"/api/projects/{project.id}/", headers=self.headers
        )
        self.assertEqual(response.status_code, 204)

        task.refresh_from_db()
        self.assertIsNone(task.project)
        self.assertEqual(task.time_entries.count(), 1)


class StudyItemApiTestCase(TestCase):
    """Study item endpoints as the study page uses them (React rebuild ticket 06)."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2"
        )
        token = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2"},
            content_type="application/json",
        ).json()["access"]
        self.headers = {"authorization": f"Bearer {token}"}

    def log(self, item, body=None):
        return self.client.post(
            f"/api/study-items/{item.id}/log_interaction/",
            body if body is not None else {},
            content_type="application/json",
            headers=self.headers,
        )


class StudyInteractionTests(StudyItemApiTestCase):
    """R43-R45: prime and study are independent interaction types on every
    item; each records first-ever and most-recent dates and its own count."""

    def test_logging_a_prime_records_count_and_first_and_last_dates(self):
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")

        response = self.log(item, {"interaction": "prime"})
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["prime_count"], 1)
        self.assertIsNotNone(data["first_primed_at"])
        self.assertIsNotNone(data["last_primed_at"])
        self.assertEqual(data["study_count"], 0)

    def test_second_prime_moves_last_but_keeps_first(self):
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")
        first = self.log(item, {"interaction": "prime"}).json()
        second = self.log(item, {"interaction": "prime"}).json()

        self.assertEqual(second["prime_count"], 2)
        self.assertEqual(second["first_primed_at"], first["first_primed_at"])
        self.assertGreaterEqual(second["last_primed_at"], first["last_primed_at"])

    def test_logging_a_study_records_its_own_dates_and_count(self):
        item = StudyItem.objects.create(
            user=self.user, prompt="Kanji: 水", notes="water; radical in 泳"
        )

        data = self.log(item, {"interaction": "study"}).json()
        self.assertEqual(data["study_count"], 1)
        self.assertIsNotNone(data["first_studied_at"])
        self.assertIsNotNone(data["last_studied_at"])
        self.assertEqual(data["prime_count"], 0)

    def test_study_interaction_requires_an_answer_side(self):
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")

        response = self.log(item, {"interaction": "study"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("notes", response.json()["detail"].lower())
        item.refresh_from_db()
        self.assertEqual(item.study_count, 0)

    def test_study_interaction_accepts_a_note_image_instead_of_notes(self):
        """An answer can be an image rather than text (ticket 06.3)."""
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")
        item.note_image = "study_item_images/note.png"
        item.save(update_fields=["note_image"])

        response = self.log(item, {"interaction": "study"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["study_count"], 1)

    def test_unknown_interaction_type_is_rejected(self):
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")

        response = self.log(item, {"interaction": "cram"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())

    def test_explicit_type_ignores_the_items_legacy_mode(self):
        # A legacy item mid-flow in "studying" mode still logs a prime
        # when the new UI asks for one explicitly.
        item = StudyItem.objects.create(
            user=self.user,
            prompt="Kanji: 水",
            is_priming=False,
            is_studying=True,
        )

        data = self.log(item, {"interaction": "prime"}).json()
        self.assertEqual(data["prime_count"], 1)
        self.assertEqual(data["study_count"], 0)

    def test_legacy_call_without_a_type_still_logs_by_mode(self):
        item = StudyItem.objects.create(
            user=self.user,
            prompt="Kanji: 水",
            is_priming=False,
            is_studying=True,
        )

        data = self.log(item).json()
        self.assertEqual(data["study_count"], 1)
        self.assertEqual(data["prime_count"], 0)

    def test_prime_timestamps_history_grows(self):
        item = StudyItem.objects.create(user=self.user, prompt="Kanji: 水")
        self.log(item, {"interaction": "prime"})
        self.log(item, {"interaction": "prime"})

        item.refresh_from_db()
        self.assertEqual(len(item.prime_timestamps), 2)
