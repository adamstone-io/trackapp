from django.contrib.auth.models import User
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from math import ceil
from uuid import UUID
from django.db.models import (
    Case, Count, DateTimeField, F, IntegerField, Min, Q, Sum, Value, When,
)
from django.db.models.functions import Coalesce, Greatest
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password

from .emails import send_password_reset_email, send_verification_email
from .models import (
    ActiveTimer,
    local_date,
    EmailVerification,
    Habit,
    PasswordReset,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
    UserSubscription,
)
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .permissions import HasAppAccess
from .subscription_utils import ensure_user_subscription
from .serializers import (
    lowercase_title,
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
    throttle_scope = "auth-register"

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

        try:
            validate_password(password)
        except DjangoValidationError as error:
            return Response(
                {"detail": " ".join(error.messages)},
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


class PasswordResetRequestView(APIView):
    """POST /api/auth/password-reset/ — email a link to set a new password.

    Answers the same way whether or not the address is on an account: the
    endpoint is reachable without logging in, so a specific answer would make
    it a way to ask which emails have accounts. Same rule as resend.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth-password"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return _bad_request("Email is required.")

        generic_ok = Response(
            {"detail": "If that email is on an account, we've sent a reset link."}
        )

        user = User.objects.filter(email__iexact=email).first()
        # An account that never verified has no password worth resetting — its
        # way in is the verification link, which proves the same thing.
        if user is None or not user.is_active:
            return generic_ok

        # A fresh request retires the outstanding ones: asking again because
        # the first mail went astray should not leave two live links.
        PasswordReset.objects.filter(user=user, used_at=None).update(
            used_at=timezone.now()
        )
        reset = PasswordReset.objects.create(user=user)

        try:
            send_password_reset_email(user, reset.token)
        except Exception:
            # Same as verification: a mail failure is not the caller's to see,
            # and saying so here would leak that the account exists.
            pass

        return generic_ok


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm/ — spend the link, set the password."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth-password"

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        new_password = request.data.get("new_password") or ""

        if not token or not new_password:
            return _bad_request("Both the token and the new password are required.")

        reset = PasswordReset.objects.select_related("user").filter(token__in=_as_uuid(token)).first()
        # Spent, stale and unknown are one answer: which of the three it was
        # is not something an unauthenticated caller should be able to probe.
        if reset is None or reset.is_spent or reset.is_expired:
            return _bad_request("That reset link is no longer valid. Request a new one.")

        try:
            validate_password(new_password, user=reset.user)
        except DjangoValidationError as error:
            return _bad_request(" ".join(error.messages))

        with transaction.atomic():
            reset.used_at = timezone.now()
            reset.save(update_fields=["used_at"])
            reset.user.set_password(new_password)
            reset.user.save(update_fields=["password"])

        # Whoever knew the old password keeps no session: a reset is what
        # someone does when they have lost control of the account.
        _revoke_refresh_tokens(reset.user)

        return Response({"detail": "Password reset. You can now log in."})


def _as_uuid(token):
    """The token as a one-item list, or none at all if it isn't a UUID.

    A malformed token has to read as "no such reset" rather than raising —
    the field is a UUID, and anything can be typed into a URL.
    """
    try:
        return [UUID(token)]
    except (ValueError, AttributeError, TypeError):
        return []


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


def _account_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "subscription": _subscription_payload(user),
    }


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    # The username is the login identifier, so it is read-only; the names and
    # the email are the settings page's to edit.
    NAME_FIELDS = ("first_name", "last_name")

    def get(self, request):
        return Response(_account_payload(request.user), status=status.HTTP_200_OK)

    def patch(self, request):
        """A true partial patch: a field absent from the body is left alone."""
        if "username" in request.data:
            requested_username = (request.data.get("username") or "").strip()
            if requested_username and requested_username != request.user.username:
                return Response(
                    {"detail": "Username cannot be changed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        changed = []

        for field in self.NAME_FIELDS:
            if field not in request.data:
                continue
            value = (request.data.get(field) or "").strip()
            if len(value) > 150:
                return Response(
                    {"detail": "That name is too long."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            setattr(request.user, field, value)
            changed.append(field)

        if "email" in request.data:
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

            if User.objects.filter(email=email).exclude(pk=request.user.pk).exists():
                return Response(
                    {"detail": "An account with that email already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if request.user.email != email:
                request.user.email = email
                changed.append("email")

        if changed:
            request.user.save(update_fields=changed)

        return Response(_account_payload(request.user), status=status.HTTP_200_OK)

    def delete(self, request):
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectViewSet(UserOwnedViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user).annotate(
            total_seconds=Coalesce(Sum("tasks__time_entries__duration_seconds"), 0),
        )


def day_start_in_timezone(user_timezone, date_str=None):
    """Start of a day at 00:00 in the user's timezone; today when no date."""
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

    return timezone.now().astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)


class TaskViewSet(UserOwnedViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user).annotate(
            entry_count=Count("time_entries"),
            total_seconds=Coalesce(Sum("time_entries__duration_seconds"), 0),
            # R64a: the actual start, to set against planned_start.
            first_started_at=Min("time_entries__started_at"),
        )

        # Scheduled tasks for one day, in the user's timezone (R63, R63a).
        planned_date = self.request.query_params.get('planned_date')
        if planned_date:
            start = day_start_in_timezone(
                self.request.headers.get('X-User-Timezone', 'UTC'), planned_date
            )
            queryset = queryset.filter(
                planned_start__gte=start, planned_start__lt=start + timedelta(days=1)
            ).order_by('planned_start')

        return queryset


class TimeEntryViewSet(UserOwnedViewSet):
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer

    def get_queryset(self):
        """Optional ?project= and ?task= filters; a project's entries reach it
        through their task, which is the only link an entry has to one."""
        queryset = super().get_queryset().select_related('task', 'task__project')

        project = self.request.query_params.get('project')
        if project:
            queryset = queryset.filter(task__project=project)

        task = self.request.query_params.get('task')
        if task:
            queryset = queryset.filter(task=task)

        return queryset.order_by('-started_at')


class MomentViewSet(UserOwnedViewSet):
    queryset = Moment.objects.all()
    serializer_class = MomentSerializer


def _bad_request(detail):
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


class HabitViewSet(UserOwnedViewSet):
    queryset = Habit.objects.all()
    serializer_class = HabitSerializer

    # Everything a log / unlog / back-fill can touch, saved together.
    PROGRESS_FIELDS = [
        "daily_count",
        "weekly_count",
        "monthly_count",
        "streak_count",
        "last_completed_date",
        "last_logged_at",
        "completed_dates",
    ]

    @staticmethod
    def _parse_amount(request):
        """Returns (amount, error_response); exactly one is None."""
        raw_amount = request.data.get("amount", 1) if request.data else 1
        try:
            amount = int(raw_amount)
        except (TypeError, ValueError):
            return None, _bad_request("amount must be an integer")
        if amount <= 0:
            return None, _bad_request("amount must be positive")
        return amount, None

    def _save_and_respond(self, habit):
        habit.save(update_fields=self.PROGRESS_FIELDS)
        return Response(self.get_serializer(habit).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def log(self, request, pk=None):
        """
        Log progress for a habit.

        Accepts optional 'X-User-Timezone' header with IANA timezone
        (e.g., 'Australia/Brisbane') to calculate streaks in user's local time.
        """
        habit = self.get_object()

        amount, error = self._parse_amount(request)
        if error:
            return error

        user_timezone = request.headers.get('X-User-Timezone', 'UTC')

        # An optional 'date' (YYYY-MM-DD, in the user's timezone) back-fills
        # a past day instead of logging against today.
        raw_date = request.data.get("date") if request.data else None
        day = None
        if raw_date is not None:
            try:
                day = date.fromisoformat(raw_date)
            except (TypeError, ValueError):
                return _bad_request("date must be YYYY-MM-DD")
            today = local_date(timezone.now(), user_timezone)
            if day > today:
                return _bad_request("date cannot be in the future")
            if day == today:
                day = None  # today's date is just a normal log

        if day is None:
            habit.log_progress(amount=amount, user_timezone=user_timezone)
        else:
            habit.log_progress_on(day, amount=amount, user_timezone=user_timezone)
        return self._save_and_respond(habit)

    @action(detail=True, methods=["post"])
    def unlog(self, request, pk=None):
        """Remove a mistaken log entry, reducing all three counters."""
        habit = self.get_object()

        amount, error = self._parse_amount(request)
        if error:
            return error

        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        habit.unlog_progress(amount=amount, user_timezone=user_timezone)
        return self._save_and_respond(habit)


# A never-touched item sorts ahead of every touched one, so the stand-in for
# its missing timestamp has to predate any real one. It cannot be left NULL:
# SQLite's MAX() yields NULL when any argument is NULL, where PostgreSQL's
# GREATEST skips them — the same query would order differently in dev and in
# production. Coalescing every argument makes the two agree.
NEVER_TOUCHED = datetime(1970, 1, 1, tzinfo=dt_timezone.utc)


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

    @staticmethod
    def _apply_least_recently_touched(queryset):
        """R31w's browse order: never-touched first, then oldest touch first.

        A touch is a prime, a study, or a legacy review — an item whose only
        interactions were reviews is not a new item. The page walks this order
        twenty rows at a time, so it needs a total order: `created_at` breaks
        ties between untouched items and `id` settles the rest, without which
        a row can appear on two pages or on none.
        """
        return queryset.annotate(
            _last_touched_at=Greatest(
                Coalesce('last_primed_at', Value(NEVER_TOUCHED), output_field=DateTimeField()),
                Coalesce('last_studied_at', Value(NEVER_TOUCHED), output_field=DateTimeField()),
                Coalesce('last_reviewed_at', Value(NEVER_TOUCHED), output_field=DateTimeField()),
            ),
        ).order_by('_last_touched_at', 'created_at', 'id')

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
        else:
            # The mode queries carry their own priority ordering; only the
            # plain list is the study page's browse order.
            queryset = self._apply_least_recently_touched(queryset)

        # Absent, the archived and the active come back together, as they did
        # before the list was paginated. The study page asks for one or the
        # other: they are two lists on screen, and a shared stream would draw
        # pages of archived rows into the active one.
        archived = self.request.query_params.get('archived')
        if archived is not None:
            queryset = queryset.filter(is_archived=archived.lower() in ('1', 'true'))

        # Prefix, not equality: the filter box is a type-ahead over the
        # category list, and it narrows as you type.
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__istartswith=category)

        search = self.request.query_params.get('search')

        if search:
            queryset = queryset.filter(
                Q(prompt__icontains=search) | Q(notes__icontains=search)
            )

        return queryset
        
    @action(detail=True, methods=['post'])
    def log_interaction(self, request, pk=None):
        item = self.get_object()

        # Explicit type from the React app; absent for the legacy
        # frontend, which logs by the item's current mode.
        kind = request.data.get('interaction')
        if kind is not None:
            if kind not in ('prime', 'study'):
                return Response(
                    {'detail': 'Unknown interaction type. Expected "prime" or "study".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # An item's answer side is a text note or a note image; either
            # one is something to study, but an item with neither isn't.
            if kind == 'study' and not item.notes.strip() and not item.note_image:
                return Response(
                    {'detail': 'A study interaction requires the item to have notes or a note image.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        item.log_interaction(kind)
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

def _revoke_refresh_tokens(user):
    """End every session that knew the old password.

    Changing a password is what someone does when they think it is known, so
    the old sessions have to go with it. Access tokens are self-contained and
    live out their hour; refresh tokens are the ones worth a year.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


class PasswordChangeView(APIView):
    """PATCH /api/auth/password/ — change the signed-in account's password.

    The current password is required: a borrowed session should not be able to
    lock the owner out of their own account.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "auth-password"

    def patch(self, request):
        current_password = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""

        if not current_password or not new_password:
            return _bad_request("Both the current and the new password are required.")

        if not request.user.check_password(current_password):
            return _bad_request("That is not your current password.")

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as error:
            return _bad_request(" ".join(error.messages))

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        _revoke_refresh_tokens(request.user)

        return Response({"detail": "Password changed."}, status=status.HTTP_200_OK)


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
        return day_start_in_timezone(user_timezone, date_str)

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


def _zone(tzname):
    """The IANA zone named by the X-User-Timezone header (UTC on anything else)."""
    import zoneinfo

    try:
        return zoneinfo.ZoneInfo(tzname)
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def _epoch_ms(dt):
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, dt_timezone.utc)
    return int(dt.astimezone(dt_timezone.utc).timestamp() * 1000)


def _normalize_timestamp_ms(value):
    """History arrays hold ISO strings or epoch values; read either as epoch ms.

    Returns None for anything unreadable.
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

        if isinstance(value, datetime):
            return _epoch_ms(value)

        if isinstance(value, str):
            return _epoch_ms(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except Exception:
        return None

    return None


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
        start_ms = _epoch_ms(start)
        end_ms = _epoch_ms(end)
        
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
                ts_ms = _normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    prime_count += 1
            
            for timestamp_value in item.study_timestamps:
                ts_ms = _normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    study_count += 1
            
            for timestamp_value in item.review_timestamps:
                ts_ms = _normalize_timestamp_ms(timestamp_value)
                if ts_ms is not None and start_ms <= ts_ms < end_ms:
                    review_count += 1
        
        moment_count = Moment.objects.filter(
            user=request.user,
            timestamp__gte=start,
            timestamp__lt=end,
        ).count()

        return Response({
            'period': period,
            'total_seconds': total_seconds,
            'entry_count': len(time_entries),
            'moment_count': moment_count,
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
        tz = _zone(user_timezone)
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


class DailyStatsView(APIView):
    """A per-day series of tracked time behind the dashboard's trend.

    GET /api/stats/daily/?days=N — N days ending today, oldest first, with a
    row for every day whether anything happened on it or not. Days are cut
    at midnight in the X-User-Timezone timezone. Counts for a whole period
    (moments, primes, studies) belong to StatsView, not here.
    """
    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

    DEFAULT_DAYS = 14
    MAX_DAYS = 90

    def get(self, request):
        user_timezone = request.headers.get('X-User-Timezone', 'UTC')
        tz = _zone(user_timezone)
        days = self._parse_days(request.query_params.get('days'))

        today = timezone.now().astimezone(tz).date()
        first_day = today - timedelta(days=days - 1)
        start = datetime.combine(first_day, time.min, tzinfo=tz)
        end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=tz)

        rows = {
            day.isoformat(): {'date': day.isoformat(), 'total_seconds': 0, 'entry_count': 0}
            for day in (first_day + timedelta(days=offset) for offset in range(days))
        }

        for entry in TimeEntry.objects.filter(
            user=request.user, started_at__gte=start, started_at__lt=end
        ):
            row = rows.get(entry.started_at.astimezone(tz).date().isoformat())
            if row is None:
                continue
            row['total_seconds'] += entry.duration_seconds or 0
            row['entry_count'] += 1

        return Response({'days': list(rows.values())})

    def _parse_days(self, raw):
        """A window of days, clamped to something a dashboard can draw."""
        try:
            days = int(raw)
        except (TypeError, ValueError):
            return self.DEFAULT_DAYS
        return max(1, min(days, self.MAX_DAYS))


class ActiveTimerStopView(APIView):
    """
    POST /api/active-timer/stop/ — turn the running session into a time entry.

    One step, not two. The client used to create the entry and then delete the
    timer, which left a window — seconds wide, since resolving the task walked
    every page of /tasks/ — in which another tab, or the same tab reloaded,
    still saw a live session and stopped it too. Each one wrote its own entry:
    same title, same times.

    The ActiveTimer row is the lock. Whoever takes it writes the entry;
    everyone arriving afterwards is told there is nothing to stop and writes
    nothing. That holds across tabs, devices and reloads, which no guard
    living in one browser's memory can.
    """

    permission_classes = [permissions.IsAuthenticated, HasAppAccess]

    def post(self, request):
        ended_at = self._ended_at(request.data.get("ended_at"))

        with transaction.atomic():
            timer = (
                ActiveTimer.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if timer is None:
                # The code, not the status, is what the client reads: an
                # unrouted URL is a 404 too, and a client that cannot tell the
                # two apart would treat a missing endpoint as a session
                # somebody else recorded — and quietly drop the entry.
                return Response(
                    {
                        "detail": "There is no active timer to stop.",
                        "code": "no_active_timer",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            entry = self._record(request.user, timer, ended_at)
            timer.delete()

        return Response(TimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _ended_at(raw):
        parsed = parse_datetime(raw) if isinstance(raw, str) else None
        if parsed is None:
            return timezone.now()
        return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)

    @staticmethod
    def _elapsed_seconds(timer, at):
        """The session's length, which excludes whatever it spent paused."""
        if timer.is_paused:
            return timer.elapsed_seconds
        segment = max(0, int((at - timer.started_at).total_seconds()))
        return timer.elapsed_seconds + segment

    def _record(self, user, timer, ended_at):
        duration = self._elapsed_seconds(timer, ended_at)

        # A countdown records the session that was asked for. Noticing it late
        # — a closed tab, a sleeping machine, a page nobody was looking at —
        # must not stretch the entry past the length it was set to run.
        if timer.mode == ActiveTimer.MODE_COUNTDOWN and timer.target_duration:
            overrun = duration - timer.target_duration
            if overrun > 0:
                duration = timer.target_duration
                ended_at = ended_at - timedelta(seconds=overrun)

        return TimeEntry.objects.create(
            user=user,
            task=timer.task or self._task_for(user, timer.task_title),
            task_title=timer.task_title,
            # created_at is when the session began; started_at is only the
            # current segment, which every resume resets.
            started_at=timer.created_at,
            ended_at=ended_at,
            duration_seconds=duration,
            notes="",
            breaks=[],
        )

    @staticmethod
    def _task_for(user, title):
        """The task this time belongs to, reusing one of the same name.

        Titles are stored normalised, so an exact match is the whole of the
        rule the client applied by hand — and it is one query rather than a
        walk through every task the person owns.
        """
        normalized = lowercase_title(title)
        task, _ = Task.objects.get_or_create(
            user=user, title=normalized, project=None
        )
        return task


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
