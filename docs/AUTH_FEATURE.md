# Authentication Feature

## Overview
JWT tokens for API access, all data scoped to the authenticated user. An
account is created by signing up, activated by verifying its email, and
managed from the settings page.

## Flows

**Sign up** — `/register` posts username, email, password and an invite code to
`POST /api/auth/register/`. Registration is **gated**: the backend compares the
code against `settings.REGISTRATION_CODE` (env var `REGISTRATION_CODE`, default
`4595`) and returns 403 without a match. The account is created inactive, an
email goes out, and the page directs to `/verify-email`.

**Verify** — the emailed link lands on `/verify-email?token=`, which calls
`GET /api/auth/verify-email/`. That activates the account and starts the trial.
Without a token the same page offers to resend the link. The URL is built by
`emails.verification_url()`; a test pins it to the React route, because it
addressed the deleted vanilla-JS page for a while after that frontend went.

**Log in** — `/login` takes an email *or* a username. An unverified account is
detected by the backend's error prose and redirected to `/verify-email`.

**Settings** — `/settings` edits the account, changes the password, and logs
out.

## Endpoints

| Endpoint | What it does |
|---|---|
| `POST /api/auth/register/` | Create an account (invite code required) |
| `GET /api/auth/verify-email/?token=` | Activate an account |
| `POST /api/auth/resend-verification/` | Resend the link |
| `POST /api/auth/token/` | Log in (email or username) |
| `POST /api/auth/token/refresh/` | Refresh the access token |
| `GET /api/auth/user/` | The account: names, email, subscription |
| `PATCH /api/auth/user/` | Edit `first_name`, `last_name`, `email` |
| `PATCH /api/auth/password/` | Change the password |
| `DELETE /api/auth/user/` | Delete the account — a **hard** delete, pre-dating the archive-don't-delete rule |

`PATCH /api/auth/user/` is a **true partial patch**: a field absent from the
body is left alone, so names can be saved without resending the email. The
**username is read-only** — it is the login identifier, and the endpoint
returns 400 on an attempt to change it. That is why settings has separate
first/last name fields rather than an editable username.

`PATCH /api/auth/password/` requires the current password as well as the new
one, so a borrowed session cannot lock the owner out. The new password goes
through Django's `AUTH_PASSWORD_VALIDATORS` — and so does sign-up's, which it
did not until the sign-up page made that endpoint reachable.

A successful change **revokes every refresh token on the account**
(`_revoke_refresh_tokens`, via `rest_framework_simplejwt.token_blacklist`).
Changing a password is what someone does when they think it is known, so the
old sessions go with it; a refresh token lives a year and would otherwise
outlast the change. Access tokens are self-contained and live out their hour.
The settings page therefore ends its own session and returns to login.

`POST /api/auth/register/` and `PATCH /api/auth/password/` are rate-limited
(30/hour each, via DRF's `ScopedRateThrottle`): account creation and
current-password guessing are the two endpoints worth a limit.

## Frontend
- `src/pages/SignUpPage.tsx`, `LoginPage.tsx`, `VerifyEmailPage.tsx`
- `src/pages/SettingsPage.tsx` — account, password, subscription, log out
- `src/api/auth.ts` — the endpoint wrappers
- `src/auth/tokens.ts` — localStorage keys, **matching the legacy frontend's**
  (`authAccessToken` / `authRefreshToken`) so an existing session carries over
- `src/auth/RequireAuth.tsx` — gates the app shell; settings shares its
  `["auth", "user"]` query key, so saving the account updates it everywhere

## Notes
- Tokens live in localStorage and go out as `Authorization: Bearer <token>`.
- A 401 triggers one refresh attempt, then a redirect to login.
- Logging out (`auth/session.ts`, `endSession`) clears the tokens, the query
  cache *and* the localStorage preferences — a second account logging in on the
  same browser must inherit none of it.
- **Not built: password reset for someone locked out.** Changing a password
  requires knowing it. A forgotten password currently needs a manual reset.
