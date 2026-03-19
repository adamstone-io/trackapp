from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        return token

    def validate(self, attrs):
        # Before the parent runs (which raises a generic "no active account" error),
        # check if the user exists but hasn't verified their email yet so we can
        # surface a more helpful message.
        username = attrs.get(self.username_field, "")
        try:
            user = User.objects.get(username=username)
            if (
                not user.is_active
                and hasattr(user, "email_verification")
                and not user.email_verification.is_verified
            ):
                raise serializers.ValidationError(
                    "Please verify your email before logging in. Check your inbox."
                )
        except User.DoesNotExist:
            pass  # Let the parent handle invalid credentials

        return super().validate(attrs)
