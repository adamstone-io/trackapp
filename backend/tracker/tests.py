from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from .models import Habit, Moment, Project, StudyItem, Task, TimeEntry


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


class TimeEntryFilterTests(WorkspaceApiTestCase):
    """Ticket 05.5: a project's entries reach it through their task."""

    def test_filtering_by_project_returns_only_that_projects_entries(self):
        project = Project.objects.create(user=self.user, name="TrackApp")
        other = Project.objects.create(user=self.user, name="Reading")
        write = Task.objects.create(user=self.user, title="Write", project=project)
        edit = Task.objects.create(user=self.user, title="Edit", project=project)
        loose = Task.objects.create(user=self.user, title="Errand")
        elsewhere = Task.objects.create(user=self.user, title="Chapter", project=other)
        self.entry(write, 600)
        self.entry(edit, 300)
        self.entry(loose, 100)
        self.entry(elsewhere, 100)

        rows = self.client.get(
            f"/api/time-entries/?project={project.id}", headers=self.headers
        ).json()["results"]

        self.assertEqual(len(rows), 2)
        self.assertEqual({row["task_title"] for row in rows}, {"Write", "Edit"})

    def test_filtering_by_task_returns_only_that_tasks_entries(self):
        task = Task.objects.create(user=self.user, title="Write")
        other = Task.objects.create(user=self.user, title="Edit")
        self.entry(task, 600)
        self.entry(other, 300)

        rows = self.client.get(
            f"/api/time-entries/?task={task.id}", headers=self.headers
        ).json()["results"]

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["task_title"], "Write")

    def test_entries_come_back_newest_first(self):
        task = Task.objects.create(user=self.user, title="Write")
        older = TimeEntry.objects.create(
            user=self.user,
            task=task,
            task_title="Write",
            started_at=timezone.now() - timedelta(days=2),
            ended_at=timezone.now() - timedelta(days=2, seconds=-60),
            duration_seconds=60,
        )
        newer = self.entry(task, 600)

        rows = self.client.get("/api/time-entries/", headers=self.headers).json()["results"]

        self.assertEqual([row["id"] for row in rows], [str(newer.id), str(older.id)])

    def test_another_users_entries_are_never_returned(self):
        intruder = User.objects.create_user(username="mallory", password="hunter2")
        project = Project.objects.create(user=intruder, name="Theirs")
        task = Task.objects.create(user=intruder, title="Theirs", project=project)
        TimeEntry.objects.create(
            user=intruder,
            task=task,
            task_title="Theirs",
            started_at=timezone.now(),
            ended_at=timezone.now(),
            duration_seconds=60,
        )

        rows = self.client.get(
            f"/api/time-entries/?project={project.id}", headers=self.headers
        ).json()["results"]

        self.assertEqual(rows, [])


class ScheduledTaskTests(WorkspaceApiTestCase):
    """Ticket 08: the workspace lists one day's scheduled tasks, in order."""

    def scheduled(self, title, planned_start, **extra):
        return Task.objects.create(
            user=self.user, title=title, planned_start=planned_start, **extra
        )

    def test_planned_date_returns_that_days_tasks_in_ascending_order(self):
        day = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        self.scheduled("Afternoon", day + timedelta(hours=15))
        self.scheduled("Morning", day + timedelta(hours=9))
        self.scheduled("Tomorrow", day + timedelta(days=1, hours=9))
        Task.objects.create(user=self.user, title="Unscheduled")

        rows = self.client.get(
            f"/api/tasks/?planned_date={day.date().isoformat()}",
            headers={**self.headers, "X-User-Timezone": "UTC"},
        ).json()["results"]

        self.assertEqual([row["title"] for row in rows], ["Morning", "Afternoon"])

    def test_day_boundaries_follow_the_users_timezone(self):
        """23:00 UTC on the 1st is 09:00 on the 2nd in Brisbane (UTC+10)."""
        planned = timezone.now().replace(
            year=2026, month=9, day=1, hour=23, minute=0, second=0, microsecond=0
        )
        self.scheduled("Late", planned)

        brisbane = {**self.headers, "X-User-Timezone": "Australia/Brisbane"}
        second = self.client.get("/api/tasks/?planned_date=2026-09-02", headers=brisbane).json()
        first = self.client.get("/api/tasks/?planned_date=2026-09-01", headers=brisbane).json()

        self.assertEqual([row["title"] for row in second["results"]], ["Late"])
        self.assertEqual(first["results"], [])

    def test_task_reports_its_actual_first_start_against_the_plan(self):
        day = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        task = self.scheduled("Write", day + timedelta(hours=9))
        TimeEntry.objects.create(
            user=self.user,
            task=task,
            task_title="Write",
            started_at=day + timedelta(hours=9, minutes=12),
            ended_at=day + timedelta(hours=10),
            duration_seconds=2880,
        )

        rows = self.client.get(
            f"/api/tasks/?planned_date={day.date().isoformat()}",
            headers={**self.headers, "X-User-Timezone": "UTC"},
        ).json()["results"]

        self.assertIsNotNone(rows[0]["first_started_at"])
        self.assertIn("09:12", rows[0]["first_started_at"])

    def test_a_task_never_started_reports_no_actual_start(self):
        day = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        self.scheduled("Write", day + timedelta(hours=9))

        rows = self.client.get(
            f"/api/tasks/?planned_date={day.date().isoformat()}",
            headers={**self.headers, "X-User-Timezone": "UTC"},
        ).json()["results"]

        self.assertIsNone(rows[0]["first_started_at"])


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


class HabitChainTests(HabitApiTestCase):
    """R21a: the habits chain — which days the habit was carried.

    The chain is the "don't break the chain" record: one link per day the
    habit was completed, so a skipped day shows as a gap. A day counts as
    completed when its daily target is met; a habit with no daily target
    counts any day it was logged at all.
    """

    def make_habit(self, **overrides):
        fields = dict(user=self.user, name="Meditate", daily_target=2)
        fields.update(overrides)
        return Habit.objects.create(**fields)

    def chain(self):
        return self.get_habit()["recent_completions"]

    def test_meeting_the_daily_target_adds_todays_link(self):
        habit = self.make_habit()
        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [])

        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [self.today().isoformat()])

    def test_further_logs_past_the_target_do_not_duplicate_the_link(self):
        habit = self.make_habit(daily_target=1)
        self.post_action(habit, "log")
        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [self.today().isoformat()])

    def test_unlogging_below_the_target_breaks_todays_link(self):
        habit = self.make_habit(daily_target=1)
        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [self.today().isoformat()])

        self.post_action(habit, "unlog")
        self.assertEqual(self.chain(), [])

    def test_a_habit_with_no_daily_target_links_any_day_it_was_logged(self):
        habit = self.make_habit(daily_target=0, weekly_target=3)
        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [self.today().isoformat()])

        self.post_action(habit, "unlog")
        self.assertEqual(self.chain(), [])

    def test_back_filling_a_past_day_fills_its_link(self):
        habit = self.make_habit(daily_target=2)
        yesterday = self.today() - timedelta(days=1)
        self.post_action(habit, "log", {"date": yesterday.isoformat(), "amount": 2})
        self.assertEqual(self.chain(), [yesterday.isoformat()])

    def test_a_gap_stays_a_gap(self):
        habit = self.make_habit(daily_target=1)
        two_days_ago = self.today() - timedelta(days=2)
        self.post_action(habit, "log", {"date": two_days_ago.isoformat(), "amount": 1})
        self.post_action(habit, "log")
        self.assertEqual(self.chain(), [two_days_ago.isoformat(), self.today().isoformat()])

    def test_links_older_than_the_window_are_not_reported(self):
        old = self.today() - timedelta(days=Habit.CHAIN_WINDOW_DAYS)
        edge = self.today() - timedelta(days=Habit.CHAIN_WINDOW_DAYS - 1)
        self.make_habit(completed_dates=[old.isoformat(), edge.isoformat()])
        self.assertEqual(self.chain(), [edge.isoformat()])

    def test_the_full_history_stays_off_the_wire(self):
        self.make_habit(completed_dates=[self.today().isoformat()])
        self.assertNotIn("completed_dates", self.get_habit())


class StatsApiTestCase(TestCase):
    """The dashboard's two reads: a period summary and a per-day series.

    The clock is frozen at Wednesday 2026-03-11 12:00 UTC so day boundaries
    are deterministic; Brisbane (UTC+10) is 22:00 on the same date.
    """

    FROZEN_NOW = datetime(2026, 3, 11, 12, 0, tzinfo=dt_timezone.utc)

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
        self.task = Task.objects.create(user=self.user, title="Write")

    def frozen(self):
        from unittest import mock

        return mock.patch("django.utils.timezone.now", return_value=self.FROZEN_NOW)

    def at(self, day, hour=9, minute=0):
        return datetime(2026, 3, day, hour, minute, tzinfo=dt_timezone.utc)

    def entry(self, started_at, seconds=600, user=None):
        return TimeEntry.objects.create(
            user=user or self.user,
            task=self.task,
            task_title=self.task.title,
            started_at=started_at,
            ended_at=started_at + timedelta(seconds=seconds),
            duration_seconds=seconds,
        )

    def moment(self, timestamp, user=None):
        return Moment.objects.create(
            user=user or self.user, description="A thought", timestamp=timestamp
        )

    def get(self, path, tz="UTC"):
        with self.frozen():
            response = self.client.get(path, headers={**self.headers, "x-user-timezone": tz})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def days(self, query="", tz="UTC"):
        return self.get(f"/api/stats/daily/{query}", tz=tz)["days"]

    def day(self, series, date):
        return next(row for row in series if row["date"] == date)


class StatsPeriodTests(StatsApiTestCase):
    """R31c: the period summary counts moments alongside time and study."""

    def test_the_period_summary_counts_its_moments(self):
        self.moment(self.at(11, 9))
        self.moment(self.at(11, 10))
        self.moment(self.at(10, 9))  # yesterday — outside the period

        self.assertEqual(self.get("/api/stats/?period=today")["moment_count"], 2)
        self.assertEqual(self.get("/api/stats/?period=yesterday")["moment_count"], 1)

    def test_another_users_moments_never_count(self):
        intruder = User.objects.create_user(username="eve", password="hunter2")
        self.moment(self.at(11, 9), user=intruder)

        self.assertEqual(self.get("/api/stats/?period=today")["moment_count"], 0)


class DailyStatsTests(StatsApiTestCase):
    """R31b/R31d: a per-day series of tracked time behind the trend."""

    def test_the_series_runs_from_oldest_to_today(self):
        series = self.days("?days=3")

        self.assertEqual(
            [row["date"] for row in series], ["2026-03-09", "2026-03-10", "2026-03-11"]
        )

    def test_a_day_with_no_activity_reports_zeroes_rather_than_going_missing(self):
        series = self.days("?days=2")

        self.assertEqual(self.day(series, "2026-03-10")["total_seconds"], 0)
        self.assertEqual(self.day(series, "2026-03-10")["entry_count"], 0)

    def test_each_day_totals_its_own_time_and_counts_its_own_entries(self):
        self.entry(self.at(11, 9), seconds=600)
        self.entry(self.at(11, 14), seconds=300)
        self.entry(self.at(10, 9), seconds=1200)

        series = self.days("?days=2")

        self.assertEqual(self.day(series, "2026-03-11")["total_seconds"], 900)
        self.assertEqual(self.day(series, "2026-03-11")["entry_count"], 2)
        self.assertEqual(self.day(series, "2026-03-10")["total_seconds"], 1200)
        self.assertEqual(self.day(series, "2026-03-10")["entry_count"], 1)

    def test_days_are_cut_at_midnight_in_the_users_timezone(self):
        # 2026-03-10 20:00 UTC is 2026-03-11 06:00 in Brisbane.
        self.entry(self.at(10, 20), seconds=600)

        brisbane = self.days("?days=2", tz="Australia/Brisbane")

        self.assertEqual(self.day(brisbane, "2026-03-11")["total_seconds"], 600)
        self.assertEqual(self.day(brisbane, "2026-03-10")["total_seconds"], 0)

    def test_the_window_defaults_to_a_fortnight(self):
        self.assertEqual(len(self.days()), 14)

    def test_an_unreasonable_window_is_clamped_rather_than_refused(self):
        self.assertEqual(len(self.days("?days=0")), 1)
        self.assertEqual(len(self.days("?days=9000")), 90)
        self.assertEqual(len(self.days("?days=nonsense")), 14)

    def test_another_users_activity_never_appears(self):
        intruder = User.objects.create_user(username="eve", password="hunter2")
        self.entry(self.at(11, 9), seconds=600, user=intruder)

        today = self.day(self.days("?days=2"), "2026-03-11")

        self.assertEqual(today["total_seconds"], 0)
        self.assertEqual(today["entry_count"], 0)


class AccountApiTestCase(TestCase):
    """The settings page's account section, over the HTTP API."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2please"
        )
        self.headers = {"authorization": f"Bearer {self.token('hunter2please')}"}

    def token(self, password, username="adam"):
        response = self.client.post(
            "/api/auth/token/",
            {"username": username, "password": password},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["access"]

    def get_account(self):
        response = self.client.get("/api/auth/user/", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        return response.json()

    def patch_account(self, body):
        return self.client.patch(
            "/api/auth/user/", body, content_type="application/json", headers=self.headers
        )


class AccountNameTests(AccountApiTestCase):
    """R45d: a person can correct the name on their account."""

    def test_the_account_carries_a_first_and_last_name(self):
        account = self.get_account()

        self.assertEqual(account["first_name"], "")
        self.assertEqual(account["last_name"], "")

    def test_both_names_can_be_changed(self):
        response = self.patch_account({"first_name": "Adam", "last_name": "Stone"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["first_name"], "Adam")
        self.assertEqual(response.json()["last_name"], "Stone")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Adam")

    def test_a_name_change_leaves_the_email_alone(self):
        """A partial patch is partial: names on their own must not need an email."""
        response = self.patch_account({"first_name": "Adam"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "adam@example.com")

    def test_the_email_can_still_be_changed_on_its_own(self):
        response = self.patch_account({"email": "new@example.com"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "new@example.com")

    def test_an_empty_email_is_still_refused(self):
        response = self.patch_account({"email": ""})

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "adam@example.com")

    def test_an_email_another_account_holds_is_refused(self):
        User.objects.create_user(username="eve", email="taken@example.com", password="hunter2please")

        response = self.patch_account({"email": "taken@example.com"})

        self.assertEqual(response.status_code, 400)

    def test_the_username_stays_fixed(self):
        response = self.patch_account({"username": "somebody-else"})

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "adam")

    def test_names_are_trimmed(self):
        response = self.patch_account({"first_name": "  Adam  "})

        self.assertEqual(response.json()["first_name"], "Adam")


class PasswordChangeTests(AccountApiTestCase):
    """R45e: a person can change their password from settings."""

    def change(self, body, headers=None):
        return self.client.patch(
            "/api/auth/password/",
            body,
            content_type="application/json",
            headers=self.headers if headers is None else headers,
        )

    def test_the_new_password_logs_in_and_the_old_one_stops(self):
        response = self.change(
            {"current_password": "hunter2please", "new_password": "quite-another-one"}
        )

        self.assertEqual(response.status_code, 200)
        self.token("quite-another-one")
        failed = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2please"},
            content_type="application/json",
        )
        self.assertEqual(failed.status_code, 401)

    def test_the_wrong_current_password_changes_nothing(self):
        response = self.change(
            {"current_password": "not-it", "new_password": "quite-another-one"}
        )

        self.assertEqual(response.status_code, 400)
        self.token("hunter2please")

    def test_a_password_the_validators_reject_is_refused(self):
        response = self.change({"current_password": "hunter2please", "new_password": "abc"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())
        self.token("hunter2please")

    def test_both_fields_are_required(self):
        self.assertEqual(self.change({"new_password": "quite-another-one"}).status_code, 400)
        self.assertEqual(self.change({"current_password": "hunter2please"}).status_code, 400)

    def test_a_stranger_cannot_change_a_password(self):
        response = self.change(
            {"current_password": "hunter2please", "new_password": "quite-another-one"},
            headers={},
        )

        self.assertEqual(response.status_code, 401)
        self.token("hunter2please")


class VerificationEmailTests(TestCase):
    """The link in the email has to land on a route that exists."""

    def test_the_link_points_at_the_react_verify_route(self):
        from .emails import verification_url

        url = verification_url("abc-123")

        self.assertTrue(url.endswith("/verify-email?token=abc-123"), url)
        self.assertNotIn("/html/", url)


class RegistrationPasswordTests(TestCase):
    """A password refused at the settings page must be refused at sign-up too."""

    def register(self, password):
        return self.client.post(
            "/api/auth/register/",
            {
                "username": "adam",
                "email": "adam@example.com",
                "password": password,
                "registration_code": settings.REGISTRATION_CODE,
            },
            content_type="application/json",
        )

    def test_a_password_the_validators_reject_is_refused(self):
        response = self.register("abc")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="adam").exists())

    def test_a_sound_password_is_accepted(self):
        response = self.register("quite-a-password")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="adam").exists())


class PasswordChangeEvictsSessionsTests(AccountApiTestCase):
    """R45e: changing a password must end the sessions that knew the old one.

    Otherwise a stolen refresh token outlives the change by its own lifetime,
    which is a year — so changing the password after a compromise would not
    actually evict anyone.
    """

    def refresh_token(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2please"},
            content_type="application/json",
        )
        return response.json()["refresh"]

    def test_an_old_refresh_token_stops_working(self):
        stolen = self.refresh_token()

        self.client.patch(
            "/api/auth/password/",
            {"current_password": "hunter2please", "new_password": "quite-another-one"},
            content_type="application/json",
            headers=self.headers,
        )

        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": stolen}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)

    def test_a_refused_change_leaves_the_session_alone(self):
        mine = self.refresh_token()

        self.client.patch(
            "/api/auth/password/",
            {"current_password": "wrong", "new_password": "quite-another-one"},
            content_type="application/json",
            headers=self.headers,
        )

        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": mine}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)


class TitleCaseTests(TestCase):
    """R7a: titles are stored lowercase; the UI capitalises them for reading.

    `TimeEntry.task_title` is a copy of its `Task.title`, and the stats
    endpoint reads the task's, so both have to follow the same rule or the
    dashboard and the day log disagree about the same piece of work.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2please"
        )
        token = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2please"},
            content_type="application/json",
        ).json()["access"]
        self.headers = {"authorization": f"Bearer {token}"}

    def post(self, path, body):
        return self.client.post(path, body, content_type="application/json", headers=self.headers)

    def test_a_task_title_is_stored_lowercase(self):
        response = self.post("/api/tasks/", {"title": "Write The Spec"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["title"], "write the spec")

    def test_a_time_entry_title_is_stored_lowercase(self):
        task = Task.objects.create(user=self.user, title="write the spec")

        response = self.post(
            "/api/time-entries/",
            {
                "task": str(task.id),
                "task_title": "Write The Spec",
                "started_at": (timezone.now() - timedelta(hours=2)).isoformat(),
                "ended_at": (timezone.now() - timedelta(hours=1)).isoformat(),
                "duration_seconds": 3600,
            },
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["task_title"], "write the spec")

    def test_a_running_timer_title_is_stored_lowercase(self):
        response = self.post(
            "/api/active-timer/",
            {
                "task_title": "Write The Spec",
                "started_at": (timezone.now() - timedelta(minutes=5)).isoformat(),
                "elapsed_seconds": 0,
                "is_paused": False,
                "mode": "stopwatch",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["task_title"], "write the spec")

    def test_renaming_an_entry_lowercases_the_new_title(self):
        task = Task.objects.create(user=self.user, title="write the spec")
        entry = TimeEntry.objects.create(
            user=self.user,
            task=task,
            task_title="write the spec",
            started_at=timezone.now(),
            duration_seconds=60,
        )

        response = self.client.patch(
            f"/api/time-entries/{entry.id}/",
            {"task_title": "Rewrite The Spec"},
            content_type="application/json",
            headers=self.headers,
        )

        self.assertEqual(response.json()["task_title"], "rewrite the spec")

    def test_surrounding_space_goes_with_the_case(self):
        response = self.post("/api/tasks/", {"title": "  Write The Spec  "})

        self.assertEqual(response.json()["title"], "write the spec")

    def test_a_title_that_is_only_space_is_still_refused(self):
        response = self.post("/api/tasks/", {"title": "   "})

        self.assertEqual(response.status_code, 400)
