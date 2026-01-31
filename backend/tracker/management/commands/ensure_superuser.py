from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
import os


class Command(BaseCommand):
    help = "Create or update an admin superuser from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

        if not username or not password:
            self.stdout.write(self.style.WARNING(
                "Superuser not created: DJANGO_SUPERUSER_USERNAME and/or DJANGO_SUPERUSER_PASSWORD missing."
            ))
            return

        User = get_user_model()

        # Prefer username if your User model has it; otherwise fall back to email
        lookup = {}
        if hasattr(User, "USERNAME_FIELD"):
            lookup_field = User.USERNAME_FIELD
            if lookup_field == "email":
                lookup["email"] = email or username
            else:
                lookup[lookup_field] = username
        else:
            lookup["username"] = username

        user, created = User.objects.get_or_create(defaults={"email": email or ""}, **lookup)

        changed = False

        # Ensure email set (if field exists)
        if email and hasattr(user, "email") and user.email != email:
            user.email = email
            changed = True

        # Ensure superuser/staff flags
        if not getattr(user, "is_superuser", False):
            user.is_superuser = True
            changed = True
        if not getattr(user, "is_staff", False):
            user.is_staff = True
            changed = True
        if hasattr(user, "is_active") and not user.is_active:
            user.is_active = True
            changed = True

        # Always set/update password from env (you can change this if you want one-time only)
        user.set_password(password)
        changed = True

        if changed:
            user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Superuser created: {user!s}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Superuser ensured/updated: {user!s}"))
