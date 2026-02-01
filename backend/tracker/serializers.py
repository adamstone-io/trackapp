import math
from datetime import timedelta

from rest_framework import serializers
from django.utils import timezone

from .models import (
    Habit,
    Moment,
    PrimeItem,
    Project,
    ReviewItem,
    Task,
    TimeEntry,
)


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class TimeEntrySerializer(serializers.ModelSerializer):
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
    class Meta:
        model = Habit
        fields = "__all__"
        read_only_fields = ("user", "created_at")


class PrimeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrimeItem
        fields = "__all__"
        read_only_fields = ("user", "created_at", "last_primed_at")

    def _extract_last_primed_at(self, timestamps):
        if not timestamps:
            return None
        numeric = []
        for ts in timestamps:
            if isinstance(ts, (int, float)) and math.isfinite(ts):
                numeric.append(ts)
            elif isinstance(ts, str) and ts.isdigit():
                numeric.append(int(ts))
        if not numeric:
            return None
        last_ts = max(numeric)
        return timezone.datetime.fromtimestamp(last_ts / 1000, tz=timezone.UTC)

    def _apply_last_primed_at(self, validated_data):
        if "prime_timestamps" in validated_data:
            validated_data["last_primed_at"] = self._extract_last_primed_at(
                validated_data.get("prime_timestamps")
            )

    def create(self, validated_data):
        self._apply_last_primed_at(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._apply_last_primed_at(validated_data)
        return super().update(instance, validated_data)


class PrimeItemListSerializer(serializers.ModelSerializer):
    total_count = serializers.SerializerMethodField()
    today_count = serializers.SerializerMethodField()
    week_count = serializers.SerializerMethodField()
    month_count = serializers.SerializerMethodField()
    first_primed_at = serializers.SerializerMethodField()

    class Meta:
        model = PrimeItem
        fields = (
            "id",
            "title",
            "description",
            "category",
            "archived",
            "created_at",
            "last_primed_at",
            "first_primed_at",
            "total_count",
            "today_count",
            "week_count",
            "month_count",
        )

    def _numeric_timestamps(self, timestamps):
        if not timestamps:
            return []
        numeric = []
        for ts in timestamps:
            if isinstance(ts, (int, float)) and math.isfinite(ts):
                numeric.append(int(ts))
            elif isinstance(ts, str) and ts.isdigit():
                numeric.append(int(ts))
        return numeric

    def _boundary_ms(self):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        days_since_sunday = (now.weekday() + 1) % 7
        week_start = today_start - timedelta(days=days_since_sunday)

        month_start = today_start.replace(day=1)

        return {
            "today": int(today_start.timestamp() * 1000),
            "week": int(week_start.timestamp() * 1000),
            "month": int(month_start.timestamp() * 1000),
        }

    def get_total_count(self, obj):
        return len(obj.prime_timestamps or [])

    def get_today_count(self, obj):
        timestamps = self._numeric_timestamps(obj.prime_timestamps)
        if not timestamps:
            return 0
        today_ms = self._boundary_ms()["today"]
        return sum(1 for ts in timestamps if ts >= today_ms)

    def get_week_count(self, obj):
        timestamps = self._numeric_timestamps(obj.prime_timestamps)
        if not timestamps:
            return 0
        week_ms = self._boundary_ms()["week"]
        return sum(1 for ts in timestamps if ts >= week_ms)

    def get_month_count(self, obj):
        timestamps = self._numeric_timestamps(obj.prime_timestamps)
        if not timestamps:
            return 0
        month_ms = self._boundary_ms()["month"]
        return sum(1 for ts in timestamps if ts >= month_ms)

    def get_first_primed_at(self, obj):
        timestamps = self._numeric_timestamps(obj.prime_timestamps)
        if not timestamps:
            return None
        first_ts = min(timestamps)
        return timezone.datetime.fromtimestamp(first_ts / 1000, tz=timezone.UTC)


class ReviewItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewItem
        fields = "__all__"
        read_only_fields = ("user", "created_at")