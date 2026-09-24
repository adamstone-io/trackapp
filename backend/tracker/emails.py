import resend
from django.conf import settings


def verification_url(token):
    """The link a verification email carries.

    This addressed the vanilla-JS app's /html/verify-email.html until that
    frontend was deleted; the React route is /verify-email.
    """
    return f"{settings.FRONTEND_URL}/verify-email?token={token}"


def password_reset_url(token):
    """The link a password-reset email carries."""
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


def send_password_reset_email(user, token):
    """Send a link that sets a new password without knowing the old one."""
    reset_url = password_reset_url(token)
    resend.api_key = settings.RESEND_API_KEY

    resend.Emails.send({
        "from": settings.RESEND_FROM_EMAIL,
        "to": user.email,
        "subject": "Reset your TempoTrack password",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin-bottom: 8px;">Reset your password</h2>
            <p>Hi {user.username},</p>
            <p>Click the button below to choose a new password. The link is good
               for one hour and can be used once.</p>
            <a href="{reset_url}"
               style="display: inline-block; background: #6366f1; color: #fff;
                      padding: 12px 28px; text-decoration: none; border-radius: 6px;
                      font-weight: 600; margin: 16px 0;">
                Choose a new password
            </a>
            <p style="color: #666; font-size: 13px;">
                Or copy this link:<br>
                <a href="{reset_url}" style="color: #6366f1;">{reset_url}</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">
                If you didn't ask to reset your password you can safely ignore
                this email — your current one still works.
            </p>
        </div>
        """,
    })


def send_verification_email(user, token):
    """Send an email verification link to a newly registered user."""
    verify_url = verification_url(token)
    resend.api_key = settings.RESEND_API_KEY

    resend.Emails.send({
        "from": settings.RESEND_FROM_EMAIL,
        "to": user.email,
        "subject": "Verify your TempoTrack email",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin-bottom: 8px;">Verify your email</h2>
            <p>Hi {user.username},</p>
            <p>Click the button below to verify your email and activate your TempoTrack account.</p>
            <a href="{verify_url}"
               style="display: inline-block; background: #6366f1; color: #fff;
                      padding: 12px 28px; text-decoration: none; border-radius: 6px;
                      font-weight: 600; margin: 16px 0;">
                Verify Email
            </a>
            <p style="color: #666; font-size: 13px;">
                Or copy this link:<br>
                <a href="{verify_url}" style="color: #6366f1;">{verify_url}</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">
                If you didn't create a TempoTrack account you can safely ignore this email.
            </p>
        </div>
        """,
    })
