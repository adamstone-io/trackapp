import math

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


class ReviewItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewItem
        fields = "__all__"
        read_only_fields = ("user", "created_at")