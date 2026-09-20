import math
from datetime import timedelta

from rest_framework import serializers
from django.utils import timezone

from .models import (
    ActiveTimer,
    Habit,
    local_date,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
)


def lowercase_title(value):
    """Titles are stored lowercase, so the same work reads the same everywhere.

    Case is a display decision, not data: "Write spec" and "write spec" are one
    task, and the UI capitalises for reading. Task titles and the copy a time
    entry keeps both follow this, or the dashboard (which reads the task's) and
    the day log (which reads the entry's) disagree about one piece of work.
    """
    return (value or "").strip().lower()


class ProjectSerializer(serializers.ModelSerializer):
    total_seconds = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class TaskSerializer(serializers.ModelSerializer):
    entry_count = serializers.IntegerField(read_only=True, default=0)
    total_seconds = serializers.IntegerField(read_only=True, default=0)

    def validate_title(self, value):
        title = lowercase_title(value)
        if not title:
            raise serializers.ValidationError("A title is required.")
        return title
    # R64a: when the task was actually first started, against planned_start.
    first_started_at = serializers.DateTimeField(read_only=True, required=False)

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class ActiveTimerSerializer(serializers.ModelSerializer):
    def validate_task_title(self, value):
        return lowercase_title(value)

    class Meta:
        model = ActiveTimer
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class TimeEntrySerializer(serializers.ModelSerializer):
    def validate_task_title(self, value):
        return lowercase_title(value)

    def validate(self, data):
        started_at = data.get("started_at")
        ended_at = data.get("ended_at")

        # For partial updates, fall back to existing instance values.
        if self.instance is not None:
            if started_at is None:
                started_at = self.instance.started_at
            if ended_at is None:
                ended_at = self.instance.ended_at

        if started_at and timezone.is_naive(started_at):
            started_at = timezone.make_aware(started_at, timezone.get_current_timezone())
        if ended_at and timezone.is_naive(ended_at):
            ended_at = timezone.make_aware(ended_at, timezone.get_current_timezone())

        now = timezone.now()
        if started_at and started_at > now:
            raise serializers.ValidationError(
                {"started_at": "Cannot add or edit a time entry in the future."}
            )
        if ended_at and ended_at > now:
            raise serializers.ValidationError(
                {"ended_at": "Cannot add or edit a time entry in the future."}
            )
        if started_at and ended_at and ended_at <= started_at:
            raise serializers.ValidationError(
                {"ended_at": "End time must be after start time."}
            )

        return data

    class Meta:
        model = TimeEntry
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class MomentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Moment
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class HabitSerializer(serializers.ModelSerializer):
    # The chain, trimmed to the reporting window. The stored history is
    # excluded: years of dates are of no use to a dashboard strip.
    recent_completions = serializers.SerializerMethodField()

    class Meta:
        model = Habit
        exclude = ("completed_dates",)
        read_only_fields = (
            "user",
            "created_at",
            # Counters are server-managed: they change via the log/unlog
            # actions and read as their effective (boundary-reset) values.
            "daily_count",
            "weekly_count",
            "monthly_count",
            "streak_count",
            "last_completed_date",
            "last_logged_at",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        today, tzname = self._today()
        data.update(instance.state_as_of(today, tzname))
        return data

    def get_recent_completions(self, instance):
        today, _ = self._today()
        return instance.recent_completions(today)

    def _today(self):
        """(local date, timezone name) for the requesting client."""
        request = self.context.get("request")
        tzname = request.headers.get("x-user-timezone") if request else None
        return local_date(timezone.now(), tzname), tzname


class StudyItemSerializer(serializers.ModelSerializer):

    mode = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    note_image_url = serializers.SerializerMethodField()
    today_count = serializers.SerializerMethodField()
    week_count = serializers.SerializerMethodField()
    month_count = serializers.SerializerMethodField()

    is_priming = serializers.BooleanField(required=False, default=True)
    is_studying = serializers.BooleanField(required=False, default=False)
    is_reviewing = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = StudyItem
        fields = [
            'id', 'prompt', 'notes', 'category',
            'image', 'image_url',
            'note_image', 'note_image_url',
            'is_priming', 'is_studying', 'is_reviewing', 'mode',
            'first_primed_at', 'last_primed_at',
            'first_studied_at', 'last_studied_at',
            'first_reviewed_at', 'last_reviewed_at',
            'prime_count', 'study_count', 'review_count',
            'is_archived', 'created_at',
            'today_count', 'week_count', 'month_count',
        ]

        read_only_fields = (
            'user', 'created_at',
            'prime_count', 'study_count', 'review_count',
            'first_primed_at', 'last_primed_at',
            'first_studied_at', 'last_studied_at',
            'first_reviewed_at', 'last_reviewed_at',
        )

    def get_mode(self, obj):
        return obj.get_current_mode()

    def _build_image_url(self, obj, field):
        if field:
            request = self.context.get('request')
            return request.build_absolute_uri(field.url) if request else field.url
        return None

    def get_image_url(self, obj):
        return self._build_image_url(obj, obj.image)

    def get_note_image_url(self, obj):
        return self._build_image_url(obj, obj.note_image)



    def _count_since(self, timestamps, hours=0, days=0):
        if not timestamps:
            return 0
        cutoff = timezone.now() - timedelta(hours=hours, days=days)
        cutoff_ms = int(cutoff.timestamp() * 1000)
        return sum(1 for ts in timestamps if isinstance(ts, (int, float)) and ts >= cutoff_ms)

    
    def validate(self, data):
        """Ensure exactly one mode is active"""
        # Get current values from instance (for updates)
        is_priming = data.get('is_priming', getattr(self.instance, 'is_priming', False))
        is_studying = data.get('is_studying', getattr(self.instance, 'is_studying', False))
        is_reviewing = data.get('is_reviewing', getattr(self.instance, 'is_reviewing', False))
        
        active_modes = sum([is_priming, is_studying, is_reviewing])
        if active_modes != 1:
            raise serializers.ValidationError(
                'Exactly one mode must be active (is_priming, is_studying, or is_reviewing)'
            )
        

        prompt = data.get('prompt', getattr(self.instance, 'prompt', ''))
        image = data.get('image', getattr(self.instance, 'image', None))
        note_image = data.get('note_image', getattr(self.instance, 'note_image', None))

        if not prompt and not image and not note_image:
            raise serializers.ValidationError(
                'At least one of prompt or image must be provided'
            )

        return data
    
    def create(self, validated_data):
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    def get_today_count(self, obj):
        return self._count_since(self._get_mode_timestamps(obj), hours=24)

    def get_week_count(self, obj):
        return self._count_since(self._get_mode_timestamps(obj), days=7)

    def get_month_count(self, obj):
        return self._count_since(self._get_mode_timestamps(obj), days=30)

    def _get_mode_timestamps(self, obj):
        if obj.is_priming:
            return obj.prime_timestamps or []
        if obj.is_studying:
            return obj.study_timestamps or []
        if obj.is_reviewing:
            return obj.review_timestamps or []
        return []


class StudyItemListSerializer(StudyItemSerializer):
    """Optimized serializer for list views (excludes heavy fields).

    No today/week/month counts: each one walks that row's whole timestamp
    array in Python, and no client reads them off a list row — they are paid
    for twenty times a page for nothing.
    """

    class Meta(StudyItemSerializer.Meta):
        fields = [
            'id', 'prompt', 'notes', 'category',
            'image', 'image_url',
            'note_image', 'note_image_url',
            'is_priming', 'is_studying', 'is_reviewing', 'mode',
            'first_primed_at', 'last_primed_at',
            'first_studied_at', 'last_studied_at',
            'first_reviewed_at', 'last_reviewed_at',
            'prime_count', 'study_count', 'review_count',
            'is_archived', 'created_at',
        ]
