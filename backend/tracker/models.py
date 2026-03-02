from typing import Any
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from uuid import uuid4
import os

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

    def __str__(self) -> str:
        return self.name

  
    def _start_of_week(self, day):
        return day - timedelta(days=day.weekday())  

    def _apply_resets(self, today, last_logged_date):
        if last_logged_date != today:
            self.daily_count = 0
        if self._start_of_week(last_logged_date) != self._start_of_week(today):
            self.weekly_count = 0
        if (last_logged_date.year, last_logged_date.month) != (today.year, today.month):
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

    def log_interaction(self):
        timestamp_ms = int(timezone.now().timestamp() * 1000)

        if self.is_priming:
            self.prime_count += 1
            self.prime_timestamps = [*self.prime_timestamps, timestamp_ms]
            self.last_primed_at = timezone.now()
            if self.first_primed_at is None:
                self.first_primed_at = timezone.now()

        elif self.is_studying:
            self.study_count += 1
            self.study_timestamps = [*self.study_timestamps, timestamp_ms]
            self.last_studied_at = timezone.now()
            if self.first_studied_at is None:
                self.first_studied_at = timezone.now()

        elif self.is_reviewing:
            self.review_count += 1
            self.review_timestamps = [*self.review_timestamps, timestamp_ms]
            self.last_reviewed_at = timezone.now()
            if self.first_reviewed_at is None:
                self.first_reviewed_at = timezone.now()

        return timestamp_ms