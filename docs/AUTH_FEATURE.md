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

**Reset a forgotten password** — `/forgot-password` posts an address to
`POST /api/auth/password-reset/`, which answers the same way whether or not
the address is on an account. The emailed link lands on
`/reset-password?token=`, which posts the token and the new password to
`POST /api/auth/password-reset/confirm/`. See below for what the link is worth.

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
| `PATCH /api/auth/password/` | Change the password (current one required) |
| `POST /api/auth/password-reset/` | Email a reset link |
| `POST /api/auth/password-reset/confirm/` | Spend the link, set a new password |
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

A **reset link stands in for the current password**, so it is worth no more
than the password was. `PasswordReset` rows are single-use (`used_at`) and
expire after an hour (`PasswordReset.TTL`); asking again retires the
outstanding ones, so a mail that went astray does not leave a second live
link. Spending one revokes every refresh token, for the same reason changing a
password does — more so, since a reset is what someone does when they think
the account is lost.

Both reset endpoints answer **generically**: spent, stale and unknown tokens
give one message, and an unknown address gives the same answer as a known one.
They are reachable without logging in, so a specific answer would turn them
into a way to ask which addresses have accounts. An **unverified account is
sent nothing** — its way in is the verification link, which proves the same
thing.

`POST /api/auth/register/` and the password endpoints are rate-limited
(30/hour each, via DRF's `ScopedRateThrottle`). Both reset endpoints share the
`auth-password` scope: account creation, password guessing and mail-sending
are what an open endpoint gets abused for.

## Frontend
- `src/pages/SignUpPage.tsx`, `LoginPage.tsx`, `VerifyEmailPage.tsx`
- `src/pages/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` — the locked-out
  route; login links to the first, and carries the typed identifier over only
  when it is an address
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
- The confirmation field on the reset page is checked in the browser: the
  server is only ever sent one password, and "you typed two different things"
  is not a question for it.
