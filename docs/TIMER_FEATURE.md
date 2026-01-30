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

## Notes
- Timer entries are API-backed via `/api/time-entries/`.
- Countdown favorites are stored locally.
