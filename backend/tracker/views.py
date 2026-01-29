from django.shortcuts import render

from rest_framework import viewsets

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


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer


class TimeEntryViewSet(viewsets.ModelViewSet):
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer


class MomentViewSet(viewsets.ModelViewSet):
    queryset = Moment.objects.all()
    serializer_class = MomentSerializer


class HabitViewSet(viewsets.ModelViewSet):
    queryset = Habit.objects.all()
    serializer_class = HabitSerializer


class PrimeItemViewSet(viewsets.ModelViewSet):
    queryset = PrimeItem.objects.all()
    serializer_class = PrimeItemSerializer


class ReviewItemViewSet(viewsets.ModelViewSet):
    queryset = ReviewItem.objects.all()
    serializer_class = ReviewItemSerializer