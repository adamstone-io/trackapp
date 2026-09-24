from typing import Any
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from uuid import uuid4
import os
import zoneinfo


def local_date(dt, user_timezone=None):
    """Calendar date of dt in the given IANA timezone (UTC on any failure)."""
    if user_timezone:
        try:
            return dt.astimezone(zoneinfo.ZoneInfo(user_timezone)).date()
        except Exception:
            pass
    return dt.date()

class EmailVerification(models.Model):
    """Tracks email verification state for a user account.

    Created on registration; the user's account stays inactive until
    is_verified is set to True via the verify-email endpoint.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification',
    )
    token = models.UUIDField(default=uuid4, unique=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"EmailVerification({self.user.email}, verified={self.is_verified})"


class PasswordReset(models.Model):
    """A single-use, expiring ticket to set a new password without the old one.

    Not a field on EmailVerification, and not one row per user: a reset proves
    control of the mailbox at a moment in time, so it has to expire and be
    spendable exactly once. Keeping the rows also means a fresh request can
    retire the outstanding ones rather than leaving two live links.
    """

    #: How long a link is good for. Long enough to walk to the other machine,
    #: short enough that a mailbox read later is not a way in.
    TTL = timedelta(hours=1)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_resets",
    )
    token = models.UUIDField(default=uuid4, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_spent(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() - self.created_at > self.TTL

    def __str__(self) -> str:
        return f"PasswordReset({self.user.email}, spent={self.is_spent})"


class UserSubscription(models.Model):
    """Billing / trial state per user. Stripe fields reserved for later."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    # Existing accounts before trials: full access without a clock
    is_grandfathered = models.BooleanField(default=False)
    # Set when user verifies email; 7-day trial from that moment
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    is_subscribed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def has_app_access(self) -> bool:
        if self.is_subscribed or self.is_grandfathered:
            return True
        if self.trial_ends_at is None:
            # Registered but not verified yet — inactive user; treat as no app access
            return False
        return timezone.now() <= self.trial_ends_at

    def __str__(self):
        return f"UserSubscription({self.user_id}, trial_ends={self.trial_ends_at})"


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='projects',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#6366f1")
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='tasks',
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=100, default='other')
    project = models.ForeignKey(
        Project, 
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='tasks')
    notes = models.TextField(blank=True)
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_duration = models.IntegerField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class ActiveTimer(models.Model):
    """Persists a single in-progress timer session per user.

    Created when the timer starts, deleted when it stops.
    On page reload the client restores state from this record.
    """
    MODE_STOPWATCH = "stopwatch"
    MODE_COUNTDOWN = "countdown"
    MODE_CHOICES = [
        (MODE_STOPWATCH, "Stopwatch"),
        (MODE_COUNTDOWN, "Countdown"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="active_timer",
    )
    task_title = models.CharField(max_length=255)
    task = models.ForeignKey(
        Task,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="active_timers",
    )
    started_at = models.DateTimeField()
    elapsed_seconds = models.IntegerField(default=0)
    is_paused = models.BooleanField(default=False)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_STOPWATCH)
    target_duration = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ActiveTimer({self.user}, {self.task_title})"


class TimeEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='time_entries',
    )
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='time_entries')
    task_title = models.CharField(max_length=255)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(default=0, blank=True)
    notes = models.TextField(blank=True)
    breaks = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_active(self) -> bool:
        return self.ended_at is None

    def __str__(self) -> str:
        return f"{self.task_title} - {self.started_at}"


class Moment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='moments',
    )
    description = models.TextField()
    category = models.CharField(max_length=100, default="general")
    timestamp = models.DateTimeField()
    task = models.ForeignKey(
        Task,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moments",
    )
    task_title = models.CharField(max_length=1000, blank=True)
    is_milestone = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.description[:40]


class Habit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='habits',
    )
    name = models.CharField(max_length=200)

    daily_target = models.IntegerField(default=0)
    weekly_target = models.IntegerField(default=0)
    monthly_target = models.IntegerField(default=0)

    daily_count = models.IntegerField(default=0)
    weekly_count = models.IntegerField(default=0)
    monthly_count = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    
    streak_count = models.IntegerField(default=0)
    last_completed_date = models.DateField(null=True, blank=True)
    last_logged_at = models.DateTimeField(null=True, blank=True)

    # R21a: every local date the habit was carried, ascending ISO strings.
    # The streak only remembers its own run; this is the whole chain, gaps
    # and all, so a broken link stays visible after the streak restarts.
    completed_dates = models.JSONField(default=list, blank=True)

    # How far back the API reports the chain. The stored history is never
    # trimmed — this only bounds what goes over the wire.
    CHAIN_WINDOW_DAYS = 90

    def __str__(self) -> str:
        return self.name

  
    def _start_of_week(self, day):
        return day - timedelta(days=day.weekday())

    def _boundaries_crossed(self, last, today):
        """(new_day, new_week, new_month) between two local dates."""
        return (
            last != today,
            self._start_of_week(last) != self._start_of_week(today),
            (last.year, last.month) != (today.year, today.month),
        )

    def state_as_of(self, today, user_timezone=None):
        """Effective counter values as of `today`, without mutating anything.

        Stored counts go stale between logs; a day/week/month boundary that
        has passed since last_logged_at means the counter reads as zero.
        """
        daily, weekly, monthly = self.daily_count, self.weekly_count, self.monthly_count
        if self.last_logged_at:
            last = local_date(self.last_logged_at, user_timezone)
            new_day, new_week, new_month = self._boundaries_crossed(last, today)
            if new_day:
                daily = 0
            if new_week:
                weekly = 0
            if new_month:
                monthly = 0
        # A streak is alive only while the last completion was today or
        # yesterday; during a longer gap it reads as zero (the next
        # completion restarts it at 1).
        streak = self.streak_count
        if self.last_completed_date is None or self.last_completed_date < today - timedelta(days=1):
            streak = 0
        return {
            "daily_count": daily,
            "weekly_count": weekly,
            "monthly_count": monthly,
            "streak_count": streak,
        }

    def _record_completion(self, day):
        """Add a link to the chain for `day` (idempotent)."""
        iso = day.isoformat()
        if iso not in self.completed_dates:
            self.completed_dates = sorted([*self.completed_dates, iso])

    def _withdraw_completion(self, day):
        """Remove `day`'s link — the day no longer counts as carried."""
        iso = day.isoformat()
        if iso in self.completed_dates:
            self.completed_dates = [d for d in self.completed_dates if d != iso]

    def _completes_a_day(self, count):
        """Whether `count` logs on one day have carried the habit.

        With a daily target, the target has to be met. Without one, the
        habit has nothing to hit, so any log carries the day.
        """
        if self.daily_target > 0:
            return count >= self.daily_target
        return count > 0

    def recent_completions(self, today):
        """The chain's links inside the reporting window, ending at `today`."""
        first = (today - timedelta(days=self.CHAIN_WINDOW_DAYS - 1)).isoformat()
        last = today.isoformat()
        return [day for day in self.completed_dates if first <= day <= last]

    def _apply_resets(self, today, last_logged_date):
        new_day, new_week, new_month = self._boundaries_crossed(last_logged_date, today)
        if new_day:
            self.daily_count = 0
        if new_week:
            self.weekly_count = 0
        if new_month:
            self.monthly_count = 0

    def log_progress(self, amount=1, now=None, user_timezone=None):
        """
        Log progress for this habit and update streak.
        
        Args:
            amount: Amount to increment counts by
            now: Current timestamp (defaults to timezone.now())
            user_timezone: IANA timezone string (e.g., 'Australia/Brisbane')
        """
        if amount <= 0:
            return False

        now = now or timezone.now()
        
        # Convert to user's timezone for date calculations
        if user_timezone:
            import zoneinfo
            try:
                tz = zoneinfo.ZoneInfo(user_timezone)
                local_now = now.astimezone(tz)
                today = local_now.date()
            except Exception:
                # Fallback to UTC if timezone is invalid
                tz = None
                today = now.date()
        else:
            tz = None
            today = now.date()

        # Apply resets if needed
        if self.last_logged_at:
            # Convert last_logged_at to same timezone as 'today'
            if tz:
                last_logged_local = self.last_logged_at.astimezone(tz)
                last_logged_date = last_logged_local.date()
            else:
                last_logged_date = self.last_logged_at.date()
            
            self._apply_resets(today, last_logged_date)

        if not self.is_active:
            return False

        # Increment counts
        self.daily_count += amount
        self.weekly_count += amount
        self.monthly_count += amount
        self.last_logged_at = now  # Store in UTC

        if self._completes_a_day(self.daily_count):
            self._record_completion(today)

        # Update streak if daily target completed
        if self.daily_target > 0 and self.daily_count >= self.daily_target:
            if self.last_completed_date != today:
                # Check if it's consecutive
                if self.last_completed_date == today - timedelta(days=1):
                    self.streak_count += 1
                else:
                    # Streak broken, restart
                    self.streak_count = 1
                self.last_completed_date = today

        return True

    def log_progress_on(self, day, amount=1, now=None, user_timezone=None):
        """Back-fill a log entry for a past local date.

        Only current counters exist (there is no per-day history), so the
        weekly and monthly counters absorb the amount when `day` falls in
        the current week/month, and today's daily count is never touched.
        The day earns a streak credit only when this single back-fill
        meets the daily target on its own.
        """
        if amount <= 0:
            return False

        now = now or timezone.now()
        today = local_date(now, user_timezone)

        if self.last_logged_at:
            self._apply_resets(today, local_date(self.last_logged_at, user_timezone))

        if not self.is_active:
            return False

        _, other_week, other_month = self._boundaries_crossed(day, today)
        if not other_week:
            self.weekly_count += amount
        if not other_month:
            self.monthly_count += amount
        self.last_logged_at = now

        if self._completes_a_day(amount):
            self._record_completion(day)
        if self.daily_target > 0 and amount >= self.daily_target:
            self._credit_completion(day)

        return True

    def _credit_completion(self, day):
        """Fold a target-met `day` into the streak bookkeeping."""
        if self.last_completed_date is None or day > self.last_completed_date + timedelta(days=1):
            # First completion on record, or a non-adjacent more recent day —
            # any older streak was already broken.
            self.streak_count = 1
            self.last_completed_date = day
            return
        if day == self.last_completed_date:
            return
        if day == self.last_completed_date + timedelta(days=1):
            self.streak_count += 1
            self.last_completed_date = day
            return
        streak_start = self.last_completed_date - timedelta(days=self.streak_count - 1)
        if day == streak_start - timedelta(days=1):
            # The day immediately before the streak began extends it backwards.
            self.streak_count += 1

    def unlog_progress(self, amount=1, now=None, user_timezone=None):
        """Remove a mistaken log: the inverse of log_progress.

        Decrements all three counters (never below zero) and withdraws a
        streak credit earned today if the daily count falls back below the
        target. Inactive habits stay frozen, same as log_progress.
        """
        if amount <= 0:
            return False

        now = now or timezone.now()
        today = local_date(now, user_timezone)

        if self.last_logged_at:
            self._apply_resets(today, local_date(self.last_logged_at, user_timezone))

        if not self.is_active:
            return False

        self.daily_count = max(0, self.daily_count - amount)
        self.weekly_count = max(0, self.weekly_count - amount)
        self.monthly_count = max(0, self.monthly_count - amount)
        self.last_logged_at = now

        if not self._completes_a_day(self.daily_count):
            self._withdraw_completion(today)

        if (
            self.daily_target > 0
            and self.last_completed_date == today
            and self.daily_count < self.daily_target
        ):
            # Today's completion no longer stands. If a streak remains it
            # ended yesterday; otherwise there is no completion on record.
            self.streak_count = max(0, self.streak_count - 1)
            self.last_completed_date = (
                today - timedelta(days=1) if self.streak_count else None
            )

        return True


def study_item_image_path(instance, filename):
    ext = filename.split('.')[-1].lower()
    unique_filename = f"{instance.id}_{uuid4().hex[:8]}.{ext}"
    return os.path.join('study_item_images', str(instance.user.id), unique_filename)


def study_item_note_image_path(instance, filename):
    ext = filename.split('.')[-1].lower()
    unique_filename = f"{instance.id}_note_{uuid4().hex[:8]}.{ext}"
    return os.path.join('study_item_images', str(instance.user.id), unique_filename)

class StudyItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='study_items',
    )
    
    prompt = models.TextField(max_length=10000, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    category = models.CharField(max_length=300, blank=True)

    image = models.ImageField(upload_to=study_item_image_path, null=True, blank=True)
    note_image = models.ImageField(upload_to=study_item_note_image_path, null=True, blank=True)

    is_priming = models.BooleanField(default=True)
    is_studying = models.BooleanField(default=False)
    is_reviewing = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    first_primed_at = models.DateTimeField(null=True, blank=True)
    last_primed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    first_studied_at = models.DateTimeField(null=True, blank=True)
    last_studied_at = models.DateTimeField(null=True, blank=True, db_index=True)
    first_reviewed_at = models.DateTimeField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    prime_timestamps = models.JSONField(default=list, blank=True)
    study_timestamps = models.JSONField(default=list, blank=True)
    review_timestamps = models.JSONField(default=list, blank=True)
    
    prime_count = models.IntegerField(default=0)
    study_count = models.IntegerField(default=0)
    review_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-last_studied_at', 'created_at']
        indexes = [
            models.Index(fields=['user', 'is_priming', 'is_archived']),
            models.Index(fields=['user', 'is_studying', 'is_archived']),
            models.Index(fields=['user', 'is_reviewing', 'is_archived']),
            models.Index(fields=['user', 'is_archived']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_priming=True, is_studying=False, is_reviewing=False) |
                    models.Q(is_priming=False, is_studying=True, is_reviewing=False) |
                    models.Q(is_priming=False, is_studying=False, is_reviewing=True)
                ),
                name='exactly_one_mode_active'
            )
        ]

    def __str__(self) -> str:
        return self.prompt[:100]

    def get_current_mode(self) -> str:
        if self.is_priming:
            return 'priming'
        elif self.is_studying:
            return 'studying'
        elif self.is_reviewing:
            return 'reviewing'
        else:
            return 'none'

    def transition_to_priming(self):
        if self.is_priming:
            return 

        self.is_priming = True
        self.is_studying = False
        self.is_reviewing = False

        if not self.first_primed_at:
            self.first_primed_at = timezone.now()

    def transition_to_studying(self):
        if self.is_studying:
            return

        self.is_priming = False
        self.is_studying = True
        self.is_reviewing = False

        if not self.first_studied_at:
            self.first_studied_at = timezone.now()

    def transition_to_reviewing(self):
        if self.is_reviewing:
            return

        self.is_priming = False
        self.is_studying = False
        self.is_reviewing = True

        if not self.first_reviewed_at:
            self.first_reviewed_at = timezone.now()


    def clean(self):
        from django.core.exceptions import ValidationError

        active_modes = sum([self.is_priming, self.is_studying, self.is_reviewing])

        if active_modes != 1:
            raise ValidationError("Exactly one mode must be active (is_priming, is studying, or is reviewing)")
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self._delete_image_file(self.image)
        self._delete_image_file(self.note_image)
        super().delete(*args, **kwargs)

    def remove_image(self):
        self._delete_image_file(self.image)
        self.image = None
        self.save(update_fields=["image"])

    def remove_note_image(self):
        self._delete_image_file(self.note_image)
        self.note_image = None
        self.save(update_fields=["note_image"])

    def _delete_image_file(self, field):
        if field and os.path.exists(field.path):
            os.remove(field.path)

    def log_interaction(self, kind=None):
        """Record one interaction. `kind` is 'prime', 'study', or 'review';
        when omitted, it falls back to the item's legacy mode flags."""
        if kind is None:
            kind = {
                'priming': 'prime',
                'studying': 'study',
                'reviewing': 'review',
            }.get(self.get_current_mode())

        now = timezone.now()
        timestamp_ms = int(now.timestamp() * 1000)

        if kind == 'prime':
            self.prime_count += 1
            self.prime_timestamps = [*self.prime_timestamps, timestamp_ms]
            self.last_primed_at = now
            if self.first_primed_at is None:
                self.first_primed_at = now

        elif kind == 'study':
            self.study_count += 1
            self.study_timestamps = [*self.study_timestamps, timestamp_ms]
            self.last_studied_at = now
            if self.first_studied_at is None:
                self.first_studied_at = now

        elif kind == 'review':
            self.review_count += 1
            self.review_timestamps = [*self.review_timestamps, timestamp_ms]
            self.last_reviewed_at = now
            if self.first_reviewed_at is None:
                self.first_reviewed_at = now

        return timestamp_ms