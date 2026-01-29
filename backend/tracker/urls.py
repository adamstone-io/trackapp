from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    HabitViewSet,
    MomentViewSet,
    PrimeItemViewSet,
    ProjectViewSet,
    ReviewItemViewSet,
    TaskViewSet,
    TimeEntryViewSet,
)

router = DefaultRouter()
router.register(r"projects", ProjectViewSet)
router.register(r"tasks", TaskViewSet)
router.register(r"time-entries", TimeEntryViewSet)
router.register(r"moments", MomentViewSet)
router.register(r"habits", HabitViewSet)
router.register(r"prime-items", PrimeItemViewSet)
router.register(r"review-items", ReviewItemViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
]