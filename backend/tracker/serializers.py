from rest_framework import serializers

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


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"


class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = "__all__"


class MomentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Moment
        fields = "__all__"


class HabitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habit
        fields = "__all__"


class PrimeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrimeItem
        fields = "__all__"


class ReviewItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewItem
        fields = "__all__"