from django.contrib.auth.models import User
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.utils import timezone
from datetime import timedelta, timezone as dt_timezone
from math import ceil
from django.db.models import Case, Count, F, IntegerField, Q, Sum, Value, When
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from .emails import send_verification_email
from .models import (
    ActiveTimer,
    EmailVerification,
    Habit,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
    UserSubscription,
)
from .permissions import HasAppAccess
from .subscription_utils import ensure_user_subscription
from .serializers import (
    ActiveTimerSerializer,
    HabitSerializer,
    MomentSerializer,
    ProjectSerializer,
    StudyItemSerializer,
    StudyItemListSerializer,
    TaskSerializer,
    TimeEntrySerializer,
)


def _subscription_payload(user):
    sub = ensure_user_subscription(user)

    trial_days_remaining = None
    if sub.trial_ends_at and not sub.is_grandfathered and not sub.is_subscribed:
        delta = sub.trial_ends_at - timezone.now()
        trial_days_remaining = max(0, ceil(delta.total_seconds() / 86400))

    return {
        "is_grandfathered": sub.is_grandfathered,
        "is_subscribed": sub.is_subscribed,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "trial_days_remaining": trial_days_remaining,
        "has_app_access": sub.has_app_access(),
    }


class UserOwnedViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        registration_code = (request.data.get("registration_code") or "").strip()

        if not username or not email or not password:
            return Response(
                {"detail": "Username, email, and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if registration_code != settings.REGISTRATION_CODE:
            return Response(
                {"detail": "Invalid registration code."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {"detail": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "An account with that email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create inactive user; activated once email is verified
        user = User.objects.create_user(
            username=username, email=email, password=password, is_active=False
        )
        verification = EmailVerification.objects.create(user=user)
        UserSubscription.objects.get_or_create(
            user=user,
            defaults={
                "is_grandfathered": False,
                "trial_ends_at": None,
                "is_subscribed": False,
            },
        )

        try:
            send_verification_email(user, verification.token)
        except Exception:
            # Don't fail registration if email delivery errors; user can resend
            pass

        return Response(
            {"detail": "Account created. Check your email to verify your account."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "").strip()
        if not token:
            return Response(
                {"detail": "Token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verification = EmailVerification.objects.select_related("user").get(token=token)
        except EmailVerification.DoesNotExist:
            return Response(
                {"detail": "Invalid or expired verification link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.is_verified:
            return Response({"detail": "Email already verified. You can log in."})

        verification.is_verified = True
        verification.save(update_fields=["is_verified"])
        verification.user.is_active = True
        verification.user.save(update_fields=["is_active"])

        ensure_user_subscription(verification.user)

        return Response({"detail": "Email verified. You can now log in."})


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generic response to avoid exposing account existence
        generic_ok = Response(
            {"detail": "If that email is registered and unverified, we've sent a new link."}
        )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return generic_ok

        try:
            verification = user.email_verification
        except EmailVerification.DoesNotExist:
            return generic_ok

        if verification.is_verified:
            return generic_ok

        # Rotate token on each resend for security
        from uuid import uuid4
        verification.token = uuid4()
        verification.save(update_fields=["token"])

        try:
            send_verification_email(user, verification.token)
        except Exception:
            pass

        return generic_ok


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "subscription": _subscription_payload(request.user),
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        if "username" in request.data:
            requested_username = (request.data.get("username") or "").strip()
            if requested_username and requested_username != request.user.username:
                return Response(
                    {"detail": "Username cannot be changed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {"detail": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_owner = User.objects.filter(email=email).exclude(pk=request.user.pk).exists()
        if email_owner:
            return Response(
                {"detail": "An account with that email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.email != email:
            request.user.email = email
            request.user.save(update_fields=["email"])

        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "subscription": _subscription_payload(request.user),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectViewSet(UserOwnedViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class TaskViewSet(UserOwnedViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).annotate(
            entry_count=Count("time_entries"),
            total_seconds=Sum("time_entries__duration_seconds"),
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

    @staticmethod
    def _apply_interaction_priority(queryset, timestamp_field):
        cutoff = timezone.now() - timedelta(hours=24)
        field_isnull = f'{timestamp_field}__isnull'
        field_lt = f'{timestamp_field}__lt'
        return queryset.annotate(
            _interaction_priority=Case(
                When(**{field_isnull: False, field_lt: cutoff}, then=Value(0)),
                When(**{field_isnull: True}, then=Value(1)),
                default=Value(2),
                output_field=IntegerField(),
            ),
        ).order_by(
            '_interaction_priority',
            F(timestamp_field).asc(nulls_last=True),
            'created_at',
            'id',
        )

    def get_queryset(self):
        queryset = super().get_queryset()

        mode = self.request.query_params.get('mode')

        if mode == 'priming':
            queryset = self._apply_interaction_priority(
                queryset.filter(is_priming=True), 'last_primed_at',
            )
        elif mode == 'studying':
            queryset = self._apply_interaction_priority(
                queryset.filter(is_studying=True), 'last_studied_at',
            )
        elif mode == 'reviewing':
            queryset = self._apply_interaction_priority(
                queryset.filter(is_reviewing=True), 'last_reviewed_at',
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
        if item.is_priming:
            item.log_interaction()
        item.transition_to_studying()
        item.save()

        serializer = self.get_serializer(item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def transition_to_reviewing(self, request, pk=None):
        item = self.get_object()
        if item.is_studying:
            item.log_interaction()
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
    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

    def get(self, request):
        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        date_str = request.query_params.get('date')  # optional YYYY-MM-DD
        today_start = self._get_day_start(user_timezone, date_str)
        today_end = today_start + timedelta(days=1)

        time_entries = self._get_time_entries(request.user, today_start, today_end)
        moments = self._get_moments(request.user, today_start, today_end)

        combined_entries = self._combine_and_sort(time_entries, moments)

        return Response(combined_entries)

    def _get_day_start(self, user_timezone, date_str=None):
        """
        Get the start of a day at 00:00:00 in the user's timezone.
        If date_str (YYYY-MM-DD) is provided, use that date; otherwise use today.
        """
        import zoneinfo
        import datetime as dt

        try:
            tz = zoneinfo.ZoneInfo(user_timezone)
        except Exception:
            tz = zoneinfo.ZoneInfo('UTC')

        if date_str:
            try:
                d = dt.date.fromisoformat(date_str)
                return dt.datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=tz)
            except ValueError:
                pass

        now_in_tz = timezone.now().astimezone(tz)
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
                '_sort_primary': entry.started_at,
                '_sort_secondary': entry.ended_at or entry.started_at,
                '_sort_type_priority': 1,  # Keep entries above moments when start times tie.
            })

        for moment in moments:
            combined.append({
                'type': 'moment',
                'id': str(moment.id),
                'data': MomentSerializer(moment).data,
                'sort_time': moment.timestamp.isoformat(),
                '_sort_primary': moment.timestamp,
                '_sort_secondary': moment.timestamp,
                '_sort_type_priority': 0,
            })

        # Sort latest on top by start/timestamp, then by effective end, then by type.
        # This keeps a time entry above a moment when they share the same start time.
        combined.sort(
            key=lambda x: (
                x['_sort_primary'],
                x['_sort_secondary'],
                x['_sort_type_priority'],
            ),
            reverse=True,
        )

        for item in combined:
            item.pop('_sort_primary', None)
            item.pop('_sort_secondary', None)
            item.pop('_sort_type_priority', None)

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
    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

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


class ActiveTimerView(APIView):
    """
    GET    /api/active-timer/  — return the user's active timer, or 404
    POST   /api/active-timer/  — create or replace the active timer
    PATCH  /api/active-timer/  — update fields (pause / resume)
    DELETE /api/active-timer/  — clear the active timer (timer stopped)
    """
    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

    def get(self, request):
        try:
            timer = ActiveTimer.objects.get(user=request.user)
        except ActiveTimer.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)
        return Response(ActiveTimerSerializer(timer).data)

    def post(self, request):
        # Replace any existing active timer for this user
        ActiveTimer.objects.filter(user=request.user).delete()
        serializer = ActiveTimerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        try:
            timer = ActiveTimer.objects.get(user=request.user)
        except ActiveTimer.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ActiveTimerSerializer(timer, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        ActiveTimer.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
