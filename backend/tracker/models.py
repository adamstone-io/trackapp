from django.db import models
from django.conf import settings
from uuid import uuid4

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

    def __str__(self) -> str:
        return self.name


class PrimeItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='prime_items',
    )
    title = models.CharField(max_length=1000)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    prime_timestamps = models.JSONField(default=list, blank=True)
    last_primed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title


class ReviewItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='review_items',
    )
    title = models.CharField(max_length=1000)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    review_timestamps = models.JSONField(default=list, blank=True)
    first_studied_at = models.DateTimeField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title