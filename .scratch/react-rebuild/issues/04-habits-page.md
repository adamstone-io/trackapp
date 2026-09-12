# 04: Habits page

**What to build:** A page where the user manages habits and logs daily progress. Each habit has independent daily, weekly, and monthly targets. Logging updates all three counters with one action. Streaks track consecutive days the daily target was met. The user can remove a mistaken log, back-fill a past date, and archive/restore habits.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** done (2026-09-13 — backend commit f4351e3 + habits page)

- [x] Habits list showing all active habits with current counts and streak — HabitList; archived habits render in a separate section
- [x] Create habit: name, daily/weekly/monthly targets — AddHabitForm, optimistic
- [x] Log progress: one button, calls POST /api/habits/{id}/log/, all counters update
- [x] Optimistic UI on log: counters increment immediately, rollback on error — server response then carries the authoritative streak
- [x] Remove mistaken log entry (decrement count) — new POST /api/habits/{id}/unlog/: decrements all three counters (floor 0) and withdraws a streak credit earned today if the day falls back below target
- [x] Back-fill: log a habit entry for a past date — POST log/ with `date` (+`amount`); no per-day history exists, so it bumps weekly/monthly when the date is in the current week/month (never today's daily count) and credits the streak only when the single back-fill meets the daily target on its own (the form's count field lets one back-fill carry the whole day). Known gap: a mistaken back-fill is not cleanly reversible — see ticket 04.1
- [x] Streak display: consecutive days daily target met, resets to 1 after a gap — during a gap the streak *reads* 0 (broken); the next completion restarts it at 1
- [x] Counters reset automatically at day/week/month boundaries (timezone-aware, handled by backend) — reset-on-read: GET /habits/ reports effective counters per X-User-Timezone; counters are now read-only in the serializer (legacy frontend's reset PATCHes become harmless no-ops)
- [x] Archive habit (soft delete, history preserved) — PATCH is_active=false (Habit predates the `archived` field convention)
- [x] Restore archived habit
- [x] Inactive habit: logging has no effect — log, unlog and back-fill all no-op; API still returns 200 with the unchanged habit
- [x] Edit habit (name, targets) — inline row editor
