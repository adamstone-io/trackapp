from django.contrib.auth.models import User
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta, timezone as dt_timezone
from django.db.models import Count, Q, F
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from .models import (
    Habit,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
)
from .serializers import (
    HabitSerializer,
    MomentSerializer,
    ProjectSerializer,
    StudyItemSerializer,
    StudyItemListSerializer,
    TaskSerializer,
    TimeEntrySerializer,
)


class UserOwnedViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(username=username, password=password)
        return Response(
            {"id": user.id, "username": user.username},
            status=status.HTTP_201_CREATED,
        )


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {"id": request.user.id, "username": request.user.username},
            status=status.HTTP_200_OK,
        )


class ProjectViewSet(UserOwnedViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class TaskViewSet(UserOwnedViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).annotate(
            entry_count=Count("time_entries")
        )


class TimeEntryViewSet(UserOwnedViewSet):
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer


class MomentViewSet(UserOwnedViewSet):
    queryset = Moment.objects.all()
    serializer_class = MomentSerializer


class HabitViewSet(UserOwnedViewSet):
    queryset = Habit.objects.all()
    serializer_class = HabitSerializer

    @action(detail=True, methods=["post"])
    def log(self, request, pk=None):
        """
        Log progress for a habit.
        
        Accepts optional 'X-User-Timezone' header with IANA timezone 
        (e.g., 'Australia/Brisbane') to calculate streaks in user's local time.
        """
        habit = self.get_object()

        # Parse amount
        raw_amount = request.data.get("amount", 1) if request.data else 1
        try:
            amount = int(raw_amount)
        except (TypeError, ValueError):
            return Response(
                {"detail": "amount must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {"detail": "amount must be positive"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get user timezone from header
        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        
        # Log progress with timezone awareness
        habit.log_progress(amount=amount, user_timezone=user_timezone)
        habit.save(update_fields=[
            "daily_count",
            "weekly_count",
            "monthly_count",
            "streak_count",
            "last_completed_date",
            "last_logged_at",
        ])

        serializer = self.get_serializer(habit)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudyItemViewSet(UserOwnedViewSet):
    queryset = StudyItem.objects.all().order_by("last_studied_at", "created_at")
    serializer_class = StudyItemSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return StudyItemListSerializer
        return StudyItemSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        queryset = super().get_queryset()

        mode = self.request.query_params.get('mode')

        if mode == 'priming':
            queryset = queryset.filter(is_priming=True).order_by(
                F('last_primed_at').asc(nulls_last=True),
                'created_at'
            )
        elif mode == 'studying':
            queryset = queryset.filter(is_studying=True).order_by(
                F('last_studied_at').asc(nulls_last=True),
                'created_at'
            )
        elif mode == 'reviewing':
            queryset = queryset.filter(is_reviewing=True).order_by(
                F('last_reviewed_at').asc(nulls_last=True),
                'created_at'
            )

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        
        search = self.request.query_params.get('search')

        if search:
            queryset = queryset.filter(
                Q(prompt__icontains=search) | Q(notes__icontains=search)
            )
        
        return queryset
        
    @action(detail=True, methods=['post'])
    def log_interaction(self, request, pk=None):
        item = self.get_object()
        item.log_interaction()
        item.save(update_fields=[
            'prime_count', 'study_count', 'review_count',
            'prime_timestamps', 'study_timestamps', 'review_timestamps',
            'last_primed_at', 'last_studied_at', 'last_reviewed_at',
            'first_primed_at', 'first_studied_at', 'first_reviewed_at',
        ])

        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def transition_to_priming(self, request, pk=None):
        item = self.get_object()
        item.transition_to_priming()
        item.save()

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def transition_to_studying(self, request, pk=None):
        item = self.get_object()
        item.transition_to_studying()
        item.save()

        serializer = self.get_serializer(item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def transition_to_reviewing(self, request, pk=None):
        item = self.get_object()
        item.transition_to_reviewing()
        item.save()

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        mode = request.query_params.get('mode')
        queryset = self.get_queryset().filter(is_archived=False).exclude(category='')

        if mode == 'priming':
            queryset = queryset.filter(is_priming=True)
        elif mode == 'studying':
            queryset = queryset.filter(is_studying=True)
        elif mode == 'reviewing':
            queryset = queryset.filter(is_reviewing=True)

        categories = queryset.values('category').annotate(count=Count('id')).order_by('category')

        return Response(list(categories))

    @action(detail=False, methods=['get'])
    def stats(self, request):

        user_items = self.get_queryset().filter(is_archived=False)

        from django.db.models import Sum

        return Response({
            'total': user_items.count(),
            'priming': user_items.filter(is_priming=True).count(),
            'studying': user_items.filter(is_studying=True).count(),
            'reviewing': user_items.filter(is_reviewing=True).count(),
            'total_primes': user_items.aggregate(total=Sum('prime_count'))['total'] or 0,
            'total_studies': user_items.aggregate(total=Sum('study_count'))['total'] or 0,
            'total_reviews': user_items.aggregate(total=Sum('review_count'))['total'] or 0,
})



    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_image(self, request, pk=None):
        item = self.get_object()
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
            
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        
        if image_file.content_type not in allowed_types:
            return Response(
                {'detail': 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if image_file.size > 10 * 1024 * 1024:
            return Response(
                {'detail': 'Image too large. Maximum size: 10MB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete old image if exists
        if item.image:
            item.remove_image()
        
        # Save new image
        item.image = image_file
        item.save(update_fields=['image'])
        
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'])
    def remove_image(self, request, pk=None):
        item = self.get_object()

        if not item.image:
            return Response(
                {'detail': 'No image to remove'},
                status=status.HTTP_404_NOT_FOUND
            )

        item.remove_image()
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_note_image(self, request, pk=None):
        item = self.get_object()
        image_file = request.FILES.get('note_image')

        if not image_file:
            return Response({'detail': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if image_file.content_type not in allowed_types:
            return Response(
                {'detail': 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if image_file.size > 10 * 1024 * 1024:
            return Response(
                {'detail': 'Image too large. Maximum size: 10MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if item.note_image:
            item.remove_note_image()

        item.note_image = image_file
        item.save(update_fields=['note_image'])

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'])
    def remove_note_image(self, request, pk=None):
        item = self.get_object()

        if not item.note_image:
            return Response(
                {'detail': 'No note image to remove'},
                status=status.HTTP_404_NOT_FOUND
            )

        item.remove_note_image()
        serializer = self.get_serializer(item)
        return Response(serializer.data)

class TodayEntriesView(APIView):
    """
    Optimized endpoint that returns today's time entries and moments in a single call.
    Returns enriched data with project information to avoid additional API calls.
    Sorted with latest on top (reverse chronological order).
    
    Accepts optional 'X-User-Timezone' header with IANA timezone (e.g., 'Australia/Brisbane')
    to calculate "today" in the user's local timezone.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        today_start = self._get_today_start(user_timezone)
        today_end = today_start + timedelta(days=1)

        time_entries = self._get_time_entries(request.user, today_start, today_end)
        moments = self._get_moments(request.user, today_start, today_end)

        combined_entries = self._combine_and_sort(time_entries, moments)

        return Response(combined_entries)

    def _get_today_start(self, user_timezone):
        """
        Get the start of today at 00:00:00 in the user's timezone.
        
        Args:
            user_timezone: IANA timezone string (e.g., 'Australia/Brisbane')
        
        Returns:
            Timezone-aware datetime at midnight in the user's timezone
        """
        import zoneinfo
        
        try:
            tz = zoneinfo.ZoneInfo(user_timezone)
        except Exception:
            # Fallback to UTC if timezone is invalid
            tz = zoneinfo.ZoneInfo('UTC')
        
        # Get current time in user's timezone
        now_in_tz = timezone.now().astimezone(tz)
        
        # Get midnight in user's timezone
        return now_in_tz.replace(hour=0, minute=0, second=0, microsecond=0)

    def _get_time_entries(self, user, start, end):
        """
        Get today's time entries with related task and project data.
        Uses select_related to optimize database queries.
        """
        return TimeEntry.objects.filter(
            user=user,
            started_at__gte=start,
            started_at__lt=end
        ).select_related('task', 'task__project').order_by('-started_at')

    def _get_moments(self, user, start, end):
        """Get today's moments"""
        return Moment.objects.filter(
            user=user,
            timestamp__gte=start,
            timestamp__lt=end
        ).order_by('-timestamp')

    def _combine_and_sort(self, time_entries, moments):
        """
        Combine time entries and moments into a single sorted list.
        Enriches time entries with project information to avoid additional API calls.
        """
        combined = []
        
        for entry in time_entries:
            # Serialize the entry
            entry_data = TimeEntrySerializer(entry).data
            
            # Enrich with project information if available
            if entry.task and entry.task.project:
                project = entry.task.project
                entry_data['project_name'] = project.name
                entry_data['project_color'] = project.color
                entry_data['project_id'] = str(project.id)
            
            combined.append({
                'type': 'time_entry',
                'id': str(entry.id),
                'data': entry_data,
                'sort_time': entry.started_at.isoformat(),
            })

        for moment in moments:
            combined.append({
                'type': 'moment',
                'id': str(moment.id),
                'data': MomentSerializer(moment).data,
                'sort_time': moment.timestamp.isoformat(),
            })

        # Sort by sort_time descending (latest on top)
        combined.sort(key=lambda x: x['sort_time'], reverse=True)

        return combined


class StatsView(APIView):
    """
    Stats endpoint that returns aggregated statistics for time entries.
    
    Supports period filtering via query parameter:
    - period=today: stats for today
    - period=yesterday: stats for yesterday
    - period=this_week: stats for this week
    - period=this_month: stats for this month
    
    Returns total time by task for the selected period.
    
    Accepts optional 'X-User-Timezone' header with IANA timezone (e.g., 'Australia/Brisbane')
    to calculate time periods in the user's local timezone.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        period = request.query_params.get('period', 'today')
        
        start, end, _ = self._get_period_range(period, user_timezone)
        start_ms = self._to_epoch_ms(start)
        end_ms = self._to_epoch_ms(end)
        
        # Get time entries
        time_entries = TimeEntry.objects.filter(
            user=request.user,
            started_at__gte=start,
            started_at__lt=end
        ).select_related('task', 'task__project')
        
        # Calculate total time and group by task
        from collections import defaultdict
        task_stats = defaultdict(lambda: {'total_seconds': 0, 'entry_count': 0})
        total_seconds = 0
        
        for entry in time_entries:
            duration = entry.duration_seconds or 0
            total_seconds += duration
            
            task_title = entry.task.title if entry.task else 'Untitled Task'
            task_stats[task_title]['total_seconds'] += duration
            task_stats[task_title]['entry_count'] += 1
        
        # Convert to list and sort by total time
        by_task = [
            {
                'title': title,
                'total_seconds': stats['total_seconds'],
                'entry_count': stats['entry_count']
            }
            for title, stats in task_stats.items()
        ]
        by_task.sort(key=lambda x: x['total_seconds'], reverse=True)
        
        # Get study item statistics
        study_items = StudyItem.objects.filter(
            user=request.user,
            is_archived=False
        )
        
        prime_count = 0
        study_count = 0
        review_count = 0
        
        for item in study_items:
            # Count interactions in the period
            for timestamp_value in item.prime_timestamps:
                ts_ms = self._normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    prime_count += 1
            
            for timestamp_value in item.study_timestamps:
                ts_ms = self._normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    study_count += 1
            
            for timestamp_value in item.review_timestamps:
                ts_ms = self._normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    review_count += 1
        
        return Response({
            'period': period,
            'total_seconds': total_seconds,
            'entry_count': len(time_entries),
            'by_task': by_task,
            'prime_count': prime_count,
            'study_count': study_count,
            'review_count': review_count,
        })
    
    def _get_period_range(self, period, user_timezone):
        """
        Calculate start and end timestamps for the requested period.
        
        Args:
            period: One of 'today', 'yesterday', 'this_week', 'this_month'
            user_timezone: IANA timezone string
            
        Returns:
            Tuple of (start, end, tz) where tz is the resolved timezone
        """
        import zoneinfo
        
        try:
            tz = zoneinfo.ZoneInfo(user_timezone)
        except Exception:
            tz = zoneinfo.ZoneInfo('UTC')
        
        now_in_tz = timezone.now().astimezone(tz)
        
        if period == 'today':
            start = now_in_tz.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
            
        elif period == 'yesterday':
            today_start = now_in_tz.replace(hour=0, minute=0, second=0, microsecond=0)
            start = today_start - timedelta(days=1)
            end = today_start
            
        elif period == 'this_week':
            # Start of week (Monday)
            today_start = now_in_tz.replace(hour=0, minute=0, second=0, microsecond=0)
            days_since_monday = today_start.weekday()
            start = today_start - timedelta(days=days_since_monday)
            end = now_in_tz
            
        elif period == 'this_month':
            # Start of month
            start = now_in_tz.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = now_in_tz
            
        else:
            # Default to today
            start = now_in_tz.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
        
        return start, end, tz

    def _to_epoch_ms(self, dt):
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, dt_timezone.utc)
        return int(dt.astimezone(dt_timezone.utc).timestamp() * 1000)

    def _normalize_timestamp_ms(self, value):
        """
        Normalize timestamp values stored as ISO strings or epoch values.
        Returns epoch milliseconds (int) or None.
        """
        if value is None:
            return None

        try:
            # Epoch numbers (seconds or milliseconds)
            if isinstance(value, (int, float)):
                return int(value if value > 10**11 else value * 1000)

            # Digit-only strings as epoch values
            if isinstance(value, str) and value.isdigit():
                num = int(value)
                return int(num if num > 10**11 else num * 1000)

            if isinstance(value, timezone.datetime):
                return self._to_epoch_ms(value)

            if isinstance(value, str):
                dt = timezone.datetime.fromisoformat(value.replace('Z', '+00:00'))
                return self._to_epoch_ms(dt)
        except Exception:
            return None

        return None