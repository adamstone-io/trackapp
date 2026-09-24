# 23: Password reset for someone locked out

**What to build:** `AUTH_FEATURE.md` closed with "Not built: password reset for
someone locked out. Changing a password requires knowing it. A forgotten
password currently needs a manual reset." R45e covered changing a password with
the current one; nothing covered not having it.

**Status:** done (2026-09-24)

New requirements recorded first, in the vault's `02-requirements.md`: **R45f**
(ask by email, set without the old password), **R45g** (single use, one hour,
retired by a later request), **R45h** (the request says the same thing whatever
the address), **R45i** (a reset ends every session).

- [x] `PasswordReset` model — FK not OneToOne, with `used_at` and a `TTL` of an
      hour. A reset proves control of a mailbox at a moment in time, so it has
      to expire and be spendable once (R45g)
- [x] `POST /api/auth/password-reset/` emails a link and answers generically;
      a fresh request retires outstanding ones (R45h)
- [x] `POST /api/auth/password-reset/confirm/` spends the link, validates
      against `AUTH_PASSWORD_VALIDATORS`, and revokes every refresh token
      (R45i) — spent, stale and unknown tokens all give one message
- [x] An unverified account is sent nothing: its way in is the verification
      link, which proves the same thing
- [x] A malformed token reads as "no such reset" rather than raising on the
      UUID field — anything can be typed into a URL
- [x] `/forgot-password` and `/reset-password`, reached from a link on login
      that carries the typed identifier over only when it is an address
- [x] Both endpoints on the existing `auth-password` throttle scope (30/hour)
- [x] 9 Django tests, 8 Vitest tests

**Deployment:** migration `0018_passwordreset`, and the API must be redeployed
*before* the frontend — the new pages call endpoints that do not exist yet on
the running API. `RESEND_API_KEY` and `FRONTEND_URL` must be set, as the
verification mail already needs.

**Not done here:** no reset from the CLI or Raycast; both authenticate with a
password they already have. The reset page is reachable by URL, not from
either client.
