# 02: Timer page + persistent timer bar

**What to build:** The core time tracking experience. A user can start a stopwatch or countdown timer, pause/resume, stop it, and see the completed entry appear instantly in today's log. The countdown shows a percentage indicator. Manual time entry lets the user log work after the fact. A persistent timer bar appears in the nav on every page while a timer is running. The error toast component is built here and reused by all subsequent tickets.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** done (2026-09-12, commit fdfdb7f)

- [x] Timer controls: task title input, stopwatch/countdown mode toggle, start/stop/pause/resume buttons
- [x] Countdown mode: duration input (numeric only), percentage indicator showing time used
- [x] Timer state fetched from GET /api/active-timer/ on page load (survives reload)
- [x] Start creates ActiveTimer via POST /api/active-timer/
- [x] Pause/resume via PATCH /api/active-timer/
- [x] Stop deletes ActiveTimer via DELETE /api/active-timer/ and creates TimeEntry via POST /api/time-entries/
- [x] Optimistic UI: new time entry appears in today's list immediately on stop, before server confirms
- [x] Rollback: if server rejects, optimistic entry removed, error toast shown
- [x] Error toast component: fixed position, auto-dismiss after 3-4 seconds, reusable across the app
- [x] Today's log: combined time entries + moments from GET /api/today-entries/, most recent first
- [x] Manual time entry form: task, start time (default: end of last entry), end time (default: now)
- [x] Persistent timer bar in nav: visible on all pages when timer is active, shows elapsed time, task title
- [x] Blank task title defaults to "Untitled"
- [x] Single timer enforced: cannot start a second timer while one is running
