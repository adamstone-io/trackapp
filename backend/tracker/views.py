from django.contrib.auth.models import User
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q

from .models import (
    Habit,
    Moment,
    PrimeItem,
    Project,
    ReviewItem,
    Task,
    TimeEntry,
)
from .serializers import (
    HabitSerializer,
    MomentSerializer,
    PrimeItemSerializer,
    PrimeItemListSerializer,
    ProjectSerializer,
    ReviewItemSerializer,
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


class TimeEntryViewSet(UserOwnedViewSet):
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer


class MomentViewSet(UserOwnedViewSet):
    queryset = Moment.objects.all()
    serializer_class = MomentSerializer


class HabitViewSet(UserOwnedViewSet):
    queryset = Habit.objects.all()
    serializer_class = HabitSerializer


class PrimeItemViewSet(UserOwnedViewSet):
    queryset = PrimeItem.objects.all().order_by("last_primed_at", "created_at")
    serializer_class = PrimeItemSerializer


    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return queryset

    def get_serializer_class(self):
        include_timestamps = self.request.query_params.get("include_timestamps")
        if self.action == "list" and not include_timestamps:
            return PrimeItemListSerializer
        if self.action == "log_prime":
            return PrimeItemListSerializer
        return PrimeItemSerializer

    @action(detail=True, methods=["post"])
    def log_prime(self, request, pk=None):
        item = self.get_object()
        timestamp_ms = int(timezone.now().timestamp() * 1000)
        prime_timestamps = list(item.prime_timestamps or [])
        prime_timestamps.append(timestamp_ms)
        item.prime_timestamps = prime_timestamps
        item.last_primed_at = timezone.datetime.fromtimestamp(
            timestamp_ms / 1000, tz=timezone.UTC
        )
        item.save(update_fields=["prime_timestamps", "last_primed_at"])
        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """GET /api/prime-items/categories/"""
        categories = PrimeItem.objects.filter(
            user=request.user,
            archived=False
        ).exclude(
            category=''
        ).values('category').annotate(
            count=Count('id')
        ).order_by('category')
        
        return Response(list(categories))


class ReviewItemViewSet(UserOwnedViewSet):
    queryset = ReviewItem.objects.all()
    serializer_class = ReviewItemSerializer

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