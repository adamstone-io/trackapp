from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .token_views import CustomTokenObtainPairView
from .views import (
    CurrentUserView,
    HabitViewSet,
    MomentViewSet,
    PrimeItemViewSet,
    ProjectViewSet,
    ReviewItemViewSet,
    RegisterView,
    TaskViewSet,
    TimeEntryViewSet,
    TodayEntriesView,
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
    path("api/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/auth/user/", CurrentUserView.as_view(), name="current-user"),
    path("api/auth/token/", CustomTokenObtainPairView.as_view(), name="token-obtain"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/today-entries/", TodayEntriesView.as_view(), name="today-entries"),
]