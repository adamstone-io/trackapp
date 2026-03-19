import resend
from django.conf import settings


def send_verification_email(user, token):
    """Send an email verification link to a newly registered user."""
    verify_url = f"{settings.FRONTEND_URL}/html/verify-email.html?token={token}"
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
