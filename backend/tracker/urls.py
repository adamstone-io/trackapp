from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .token_views import CustomTokenObtainPairView
from .views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ActiveTimerStopView,
    ActiveTimerView,
    CurrentUserView,
    DailyStatsView,
    HabitViewSet,
    MomentViewSet,
    PasswordChangeView,
    ProjectViewSet,
    RegisterView,
    ResendVerificationView,
    StatsView,
    StudyItemViewSet,
    TaskViewSet,
    TimeEntryViewSet,
    TodayEntriesView,
    VerifyEmailView,
)

router = DefaultRouter()
router.register(r"projects", ProjectViewSet)
router.register(r"tasks", TaskViewSet)
router.register(r"time-entries", TimeEntryViewSet)
router.register(r"moments", MomentViewSet)
router.register(r"habits", HabitViewSet)
router.register(r"study-items", StudyItemViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
    path("api/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("api/auth/resend-verification/", ResendVerificationView.as_view(), name="auth-resend-verification"),
    path(
        "api/auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="auth-password-reset",
    ),
    path(
        "api/auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("api/auth/user/", CurrentUserView.as_view(), name="current-user"),
    path("api/auth/password/", PasswordChangeView.as_view(), name="password-change"),
    path("api/auth/token/", CustomTokenObtainPairView.as_view(), name="token-obtain"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/today-entries/", TodayEntriesView.as_view(), name="today-entries"),
    path("api/stats/", StatsView.as_view(), name="stats"),
    path("api/stats/daily/", DailyStatsView.as_view(), name="stats-daily"),
    path("api/active-timer/", ActiveTimerView.as_view(), name="active-timer"),
    path(
        "api/active-timer/stop/",
        ActiveTimerStopView.as_view(),
        name="active-timer-stop",
    ),
]