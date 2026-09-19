# Timer Feature

## Overview
The Timer feature tracks focused work sessions as time entries. It supports
stopwatch and countdown modes, pausing with break logging, and linking entries
to tasks.

## Key Concepts
- **Task**: The thing you are working on. A task can be created on the fly.
- **Time Entry**: A completed session with start/end timestamps and duration.
- **Break**: A logged pause that can optionally create its own entry.
- **Countdown Mode**: Optional countdown timer with favorites.

## Usage Flow
1. Enter a task title (or leave blank to use "Untitled").
2. Start the timer (stopwatch or countdown mode).
3. Pause and optionally log a break.
4. Stop the timer to save a time entry to the API.
5. Entries show in the "Today's Time Entries" list.

## Files Structure

### Domain
- `js/domain/time-entry.js` - TimeEntry model and validation
- `js/domain/task.js` - Task model

### Controllers
- `js/controllers/timer-controller.js` - Timer logic, breaks, and save to API
- `js/controllers/countdown-controller.js` - Countdown UI and favorites
- `js/controllers/manual-time-entry-controller.js` - Manual entry flow

### Views
- `js/views/timer-view.js` - Timer controls and display
- `js/views/current-task-view.js` - Task input binding
- `js/views/list-entries-view.js` - Entry cards
- `js/views/components/break-modal.js` - Log break modal

### Data
- `js/data/storage.js` - API calls for tasks and time entries
- `js/data/duration-favorites.js` - Countdown favorites storage

### Page
- `html/timer.html` - Timer page
- `js/timer-main.js` - Entry point

## Data Model (TimeEntry)
```javascript
{
  id: string,
  taskId: string,
  taskTitle: string,
  startedAt: string, // ISO
  endedAt: string,   // ISO
  durationSeconds: number,
  notes: string,
  breaks: Array<{ id, startedAt, endedAt, durationSeconds, label, loggedEntryId }>
}
```

## Today's schedule (React app)
Beneath the timer, `src/features/scheduledTasks/TodaysSchedule.tsx` lists the
day's planned tasks with a Start button each, so a planned task begins on the
page you already work from — the workspace is for building the plan, not for
starting it. Start does not navigate: it POSTs the active timer in place, using
the planned length as a countdown.

Start is disabled while a timer is running. `POST /api/active-timer/` deletes
any existing timer before creating the new one, so an unguarded press would
discard time already on the clock without writing an entry. Stop first.

The section renders nothing when the day has no planned tasks.

## Title case
Titles are stored **lowercase** — `Task.title`, `TimeEntry.task_title` and
`ActiveTimer.task_title`, normalised by `serializers.lowercase_title()`. Case is
a display decision, not data: "Write spec" and "write spec" are one task, which
is also why `ensureTaskId` has always matched case-insensitively.

The UI capitalises the first letter for reading (`lib/text.ts`,
`capitalizeFirst`) wherever a title is listed — the day log, the timer bar and
readout, the project entries modal, the dashboard's top tasks and plan, and both
scheduled-task lists. Only the first letter, so a proper noun mid-title keeps
the case it was typed in.

The click-to-edit field seeds from the capitalised text, so a title does not
visibly flip to lowercase the moment you click it; whatever is typed is
lowercased again on save.

Migration `0017_lowercase_titles` brought existing rows to the rule. It is
irreversible in substance — the original casing is not recoverable.

## Notes
- Timer entries are API-backed via `/api/time-entries/`.
- Countdown favorites are stored locally.
- A timer started elsewhere shows up within `TIMER_POLL_MS` (2s); a window that
  is visible but unfocused keeps polling, so a second monitor stays live.
