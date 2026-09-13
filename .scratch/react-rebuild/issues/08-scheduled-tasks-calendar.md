# 08: Scheduled tasks + Calendar page

**What to build:** The ability to plan and execute scheduled work. The user creates scheduled tasks with a title, start/end time, optional project, and notes. A daily calendar page shows today's tasks in chronological order. A start button on each task launches the timer, logging both the scheduled start time and the actual start time. The resulting time entry preserves both times. Scheduled tasks also appear on the dashboard.

**Blocked by:** 02 (Timer page), 05 (Projects & Workspace)

**Status:** wontfix — out of scope for the rebuild (2026-09-13, owner)

**Why:** a calendar is a feature in its own right, and the rebuild reads better
with depth elsewhere (ticket 09, spaced repetition) than with a thin calendar.
Kept on file rather than deleted: the valuable part is the scheduled-vs-actual
start comparison, which needs a list — not a calendar — and can return as its
own ticket later. Requirements R62, R62a, R63, R63a, R64, R64a, R64b and R60's
scheduled-tasks half are unimplemented by design; see traceability.md.

- [ ] Backend: ScheduledTask model (title, scheduled_start, scheduled_end, notes, project FK nullable, user FK) + CRUD endpoints
- [ ] Backend: TimeEntry extended with nullable scheduled_task FK, is_scheduled boolean, scheduled_start field
- [ ] Backend: ScheduledTask start action that creates ActiveTimer and logs both scheduled and actual start times
- [ ] Workspace page: create/edit/delete scheduled tasks with title, start time, end time, optional project, optional notes
- [ ] Calendar page (/calendar): today's scheduled tasks in ascending chronological order
- [ ] Start button on each scheduled task: starts timer immediately
- [ ] System logs both scheduled_start and actual start time on the ActiveTimer/TimeEntry
- [ ] Stopping the timer creates a TimeEntry with scheduled_task FK, is_scheduled=True, both start times
- [ ] Completed scheduled task time entry appears in today's log alongside other entries
- [ ] Dashboard: scheduled tasks listed in ascending chronological order
- [ ] Optimistic UI on all mutations with rollback + error toast
- [ ] Notes live on ScheduledTask only, not duplicated to TimeEntry
