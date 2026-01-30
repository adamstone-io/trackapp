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

## Notes
- Reset timestamps are stored locally to determine daily/weekly resets.
- Habit data is API-backed via `/api/habits/`.
