from django.contrib.auth.models import User
from django.test import TestCase


class EmailLoginTests(TestCase):
    """The React login form offers "email or username" as the identifier."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="adam", email="adam@example.com", password="hunter2"
        )

    def test_login_with_username(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())

    def test_login_with_email(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_login_with_email_is_case_insensitive(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "Adam@Example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def test_login_with_unknown_email_fails(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "nobody@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_ambiguous_email_does_not_log_into_an_arbitrary_account(self):
        # Legacy data may hold case-variant duplicate emails; refuse to guess.
        User.objects.create_user(
            username="adam2", email="Adam@example.com", password="hunter2"
        )
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_unverified_login_message_is_stable(self):
        # The React login page redirects to /verify-email by matching this
        # message. If the copy changes, update web/src/pages/LoginPage.tsx too.
        unverified = User.objects.create_user(
            username="newbie",
            email="newbie@example.com",
            password="hunter2",
            is_active=False,
        )
        from .models import EmailVerification

        EmailVerification.objects.create(user=unverified)
        response = self.client.post(
            "/api/auth/token/",
            {"username": "newbie", "password": "hunter2"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("verify your email", str(response.json()).lower())

    def test_login_with_wrong_password_fails(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "adam@example.com", "password": "wrong"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
