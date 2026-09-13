# 08: Scheduled tasks in the workspace

**What to build:** The workspace holds projects and, beneath them, the tasks
scheduled for a given day. Pick a day, list that day's tasks in chronological
order, and start one with a single press — which starts the timer for it and
records both the scheduled and the actual start, so plan and reality can be
compared.

**Deliberately not a calendar.** No grid, no week or month view, no drag to
reschedule. The requirement is a daily task scheduler, and calling it one sets
the right expectation; a page called "Calendar" would promise a feature set this
isn't trying to build (owner's call, 2026-09-13, reversing the 08 wontfix).

**Backend, as built:** no new model. `/api/tasks/` gained `?planned_date=`
(day boundaries from X-User-Timezone, ordered by planned_start) and a
`first_started_at` annotation — Min over the task's entries — so plan and
reality travel with the row and nothing has to persist the comparison. The day
helper TodayEntriesView had privately is now the shared
`day_start_in_timezone()`.

**Blocked by:** 05 (projects), 02 (timer)

**Status:** done (2026-09-13)

- [x] Workspace shows a scheduled-tasks section below projects
- [x] Day selector, defaulting to today — scheduling ahead is the point
- [x] Create a scheduled task: title, start time, end time, optional project,
      optional notes (R62, R62a)
- [x] The day's tasks list in ascending chronological order (R63, R33b)
- [x] Each task has a start button that starts the timer for it immediately
      and takes the user to the timer (R64)
- [x] Starting one records scheduled start *and* actual start, so the two can
      be compared (R64a)
- [x] Stopping it records a time entry in the day's log like any other (R64b)
- [x] Edit, archive and delete a scheduled task through the ⋮ RowMenu
- [x] Optimistic UI with rollback + error toast

**Requirements note:** R63a was reworded on 2026-09-13 to match — a day's
scheduled tasks are a list in the workspace, ordered by time, with no calendar
view. Nothing in the requirements asks for a calendar any more.
