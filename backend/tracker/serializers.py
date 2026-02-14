import math
from datetime import timedelta

from rest_framework import serializers
from django.utils import timezone

from .models import (
    Habit,
    Moment,
    Project,
    StudyItem,
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


class StudyItemSerializer(serializers.ModelSerializer):
    
    
    mode = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    total_interactions = serializers.SerializerMethodField()
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
            'is_priming', 'is_studying', 'is_reviewing', 'mode',
            'first_primed_at', 'last_primed_at',
            'first_studied_at', 'last_studied_at',
            'first_reviewed_at', 'last_reviewed_at',
            'interaction_timestamps',
            'prime_count', 'study_count', 'review_count',
            'is_archived', 'created_at',
            'total_interactions', 'today_count', 'week_count', 'month_count',
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

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_total_interactions(self, obj):
        return len(obj.interaction_timestamps or [])

    def get_today_count(self, obj):
        return self._count_since(obj.interaction_timestamps, hours=24)

    def get_week_count(self, obj):
        return self._count_since(obj.interaction_timestamps, days=7)

    def get_month_count(self, obj):
        return self._count_since(obj.interaction_timestamps, days=30)

    def _count_since(self, timestamps, hours=0, days=0):
        if not timestamps:
            return 0
        cutoff = timezone.now() - timedelta(hours=hours, days=days)
        cutoff_ms = int(cutoff.timestamp() * 1000)
        return sum(1 for ts in timestamps if isinstance(ts, (int, float)) and ts >= cutoff_ms)

    def _update_timestamps(self, validated_data):
        """Update timestamp fields based on interaction_timestamps"""
        if 'interaction_timestamps' not in validated_data:  # ← FIXED
            return 
        
        timestamps = validated_data['interaction_timestamps']
        
        if timestamps:
            # Update last interacted
            numeric_ts = [ts for ts in timestamps if isinstance(ts, (int, float))]
            if numeric_ts:
                last_ts = max(numeric_ts)
                
                # Determine which mode's last timestamp to update based on current mode
                is_priming = validated_data.get('is_priming', getattr(self.instance, 'is_priming', False))
                is_studying = validated_data.get('is_studying', getattr(self.instance, 'is_studying', False))
                is_reviewing = validated_data.get('is_reviewing', getattr(self.instance, 'is_reviewing', False))
                
                last_dt = timezone.datetime.fromtimestamp(last_ts / 1000, tz=timezone.UTC)
                
                if is_priming:
                    validated_data['last_primed_at'] = last_dt
                    if not validated_data.get('first_primed_at'):
                        first_ts = min(numeric_ts)
                        validated_data['first_primed_at'] = timezone.datetime.fromtimestamp(
                            first_ts / 1000, tz=timezone.UTC
                        )
                elif is_studying:
                    validated_data['last_studied_at'] = last_dt
                    if not validated_data.get('first_studied_at'):
                        first_ts = min(numeric_ts)
                        validated_data['first_studied_at'] = timezone.datetime.fromtimestamp(
                            first_ts / 1000, tz=timezone.UTC
                        )
                elif is_reviewing:
                    validated_data['last_reviewed_at'] = last_dt
                    if not validated_data.get('first_reviewed_at'):
                        first_ts = min(numeric_ts)
                        validated_data['first_reviewed_at'] = timezone.datetime.fromtimestamp(
                            first_ts / 1000, tz=timezone.UTC
                        )
    
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

        if not prompt and not image:
            raise serializers.ValidationError(
                'At least one of prompt or image must be provided'
            )

        return data
    
    def create(self, validated_data):
        self._update_timestamps(validated_data)  # ← FIXED
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        self._update_timestamps(validated_data)  # ← FIXED
        return super().update(instance, validated_data)


class StudyItemListSerializer(StudyItemSerializer):
    """Optimized serializer for list views (excludes heavy fields)"""
    
    class Meta(StudyItemSerializer.Meta):
        fields = [
            'id', 'prompt', 'category',
            'image_url',
            'is_priming', 'is_studying', 'is_reviewing', 'mode',
            'prime_count', 'study_count', 'review_count',
            'last_primed_at', 'last_studied_at', 'last_reviewed_at',
            'is_archived', 'created_at',
            'total_interactions', 'today_count', 'week_count', 'month_count'
        ]
