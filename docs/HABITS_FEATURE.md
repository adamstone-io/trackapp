# Habits Feature

## Overview
Habits track recurring behaviors with daily, weekly, and monthly targets. You
can log progress, edit targets, and archive items.

## Key Concepts
- **Habit**: A recurring activity with targets and counters.
- **Targets**: Daily/weekly/monthly goals.
- **Counts**: Running totals that reset daily/weekly.
- **Archive**: Soft-deactivate a habit.

## Usage Flow
1. Add a habit with daily/weekly targets.
2. Click "Log +1" to increment counts.
3. Edit targets or archive a habit from the menu.

## Files Structure

### Domain
- `js/domain/habit.js` - Habit model with counters and reset logic

### Controller
- `js/controllers/habit-controller.js` - CRUD + count resets (API-backed)

### Views
- `js/views/habit-view.js` - Habit cards and modals

### Data
- `js/data/storage.js` - API calls for `/api/habits/`

### Page
- `html/habits.html` - Habits page
- `js/habits-main.js` - Entry point

## Data Model
```javascript
{
  id: string,
  name: string,
  targets: { daily: number, weekly: number, monthly: number },
  counts: { daily: number, weekly: number, monthly: number },
  isActive: boolean,
  createdAt: string
}
```

## The chain (R21a)
`Habit.completed_dates` records every local date the habit was carried — its
daily target met, or, for a habit with no daily target, logged at all. Logging
adds the day, unlogging back below the target withdraws it, and a back-fill
fills the past day's link.

The API never sends the whole history: `HabitSerializer` exposes
`recent_completions`, the dates inside `Habit.CHAIN_WINDOW_DAYS` (90) ending
today in the user's timezone. The dashboard draws the last 28 of them as a
chain — consecutive days joined, a skipped day leaving the break.

Unlogging is destructive to the chain: it withdraws today's link outright
rather than archiving it, and only today's — a mistaken back-fill of a past day
cannot be taken back.

A live chain is drawn in `--color-accent-green`, the accent's luminance-matched
green peer; once it breaks, the carried days fall back to muted grey. Green on
the row is the page's one signal that a habit is currently held.

The chain is not the streak. `streak_count` remembers only its own live run and
reads zero during a gap; the chain keeps the gaps, which is the point of it.

## Notes
- Reset timestamps are stored locally to determine daily/weekly resets.
- Habit data is API-backed via `/api/habits/`.
