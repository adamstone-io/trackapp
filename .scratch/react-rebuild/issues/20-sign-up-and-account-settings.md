# 20: Sign-up and account settings

**What to build:** The app had no way to create an account —
`POST /api/auth/register/` had sat unused since ticket 01 — and `/settings` was
a five-line stub returning an empty `PageShell`, reachable from the nav.

**Owner decisions (2026-09-14):**
- Registration **stays gated**. The sign-up page collects the invite code
  rather than the `REGISTRATION_CODE` check being lifted.
- The **username cannot change** — it is the login identifier. Settings edits
  **first and last name** instead.

**Blocked by:** nothing.

**Status:** done (2026-09-14)

- [x] `/register` page: username, email, password, invite code → verify-email
- [x] Login page links to sign-up, and back
- [x] `first_name` / `last_name` on `GET` and `PATCH /api/auth/user/`
- [x] `PATCH /api/auth/user/` becomes a true partial patch — it used to demand
      an email on every call, so names could not be saved on their own
- [x] `PATCH /api/auth/password/` — current password required, new one run
      through Django's validators
- [x] Settings: account form, password form, subscription state, log out
- [x] Log out clears the query cache as well as the tokens
- [x] The verification email pointed at `/html/verify-email.html`, a page
      deleted with the vanilla-JS frontend. Now `/verify-email`, pinned by a
      test. `FRONTEND_URL` default moved from :5500 to Vite's :5173

**From the code review, all fixed:**
- [x] Sign-up ran no password validation while the settings form did, so `abc`
      was accepted at account creation and refused at change
- [x] A changed password left every refresh token alive for its full year —
      exactly the wrong outcome for the action taken on a suspected compromise.
      `token_blacklist` is installed; a change revokes them and the settings
      page ends its own session
- [x] `register` and `password` are rate-limited (30/hour); both are reachable
      without already holding an account
- [x] Logging out now clears the localStorage preferences too, not just the
      tokens and the cache
- [x] The sign-up success screen's button sent someone who had just been
      emailed a link to the page that asks for another one
- [x] `Field` was written twice, and its CSS copied; one `components/Field`
- [x] `["auth", "user"]` was a literal in two files; exported as
      `CURRENT_USER_KEY`
- [x] CLAUDE.md's "every mutation is optimistic" now says what it always meant:
      resource mutations. Auth forms report inline and wait for the server

**Not built — the gap worth knowing about.** There is no password reset for
someone *locked out*. Changing a password requires knowing it, so a forgotten
password needs a manual reset by hand. Closing it means: a reset-request
endpoint, a token (Django's `default_token_generator` needs no new model), a
second email in `emails.py`, and two pages (`/forgot-password`,
`/reset-password?uid=&token=`). Its own ticket.

**Requirements:** recorded in `02-requirements.md` in the Obsidian vault
(canonical) as R45c (registration stays invite-gated), R45d (first/last name
editable, username fixed) and R45e (password change with the current one),
under §2.9 Access Control.
