from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import EmailVerification, UserSubscription


def ensure_user_subscription(user):
    """Return a guaranteed subscription row with sane defaults.

    - Legacy accounts (no EmailVerification row) are treated as grandfathered.
    - New email-verified accounts get a trial end set if missing.
    """
    try:
        email_verification = user.email_verification
        has_email_verification = True
    except EmailVerification.DoesNotExist:
        email_verification = None
        has_email_verification = False

    sub, _ = UserSubscription.objects.get_or_create(
        user=user,
        defaults={
            "is_grandfathered": not has_email_verification,
            "trial_ends_at": None,
            "is_subscribed": False,
        },
    )

    should_start_trial = (
        not sub.is_grandfathered
        and not sub.is_subscribed
        and sub.trial_ends_at is None
        and user.is_active
        and email_verification is not None
        and email_verification.is_verified
    )
    if should_start_trial:
        sub.trial_ends_at = timezone.now() + timedelta(days=settings.TRIAL_DAYS)
        sub.save(update_fields=["trial_ends_at", "updated_at"])

    return sub
