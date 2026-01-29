from django.contrib.auth.models import User
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

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
    queryset = PrimeItem.objects.all()
    serializer_class = PrimeItemSerializer


class ReviewItemViewSet(UserOwnedViewSet):
    queryset = ReviewItem.objects.all()
    serializer_class = ReviewItemSerializer