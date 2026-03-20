from rest_framework import permissions
from rest_framework.exceptions import APIException

from .models import UserSubscription


class TrialExpired(APIException):
    status_code = 403
    default_detail = "Your free trial has ended. Subscribe to keep using TempoTrack."
    default_code = "trial_expired"


class HasAppAccess(permissions.BasePermission):
    """Block API use when the user's trial has ended and they are not subscribed."""

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return True

        try:
            sub = user.subscription
        except UserSubscription.DoesNotExist:
            return True

        if sub.has_app_access():
            return True

        raise TrialExpired()
