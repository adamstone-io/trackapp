# Moments Feature

## Overview
Moments capture quick notes or milestones at a specific point in time. They can
be linked to the currently active task and show in the daily timeline.

## Key Concepts
- **Moment**: A point-in-time note with a category and optional task link.
- **Timeline**: Moments appear alongside time entries for the current day.

## Usage Flow
1. Click "Log Moment" on the timer page.
2. Enter a description, category, and time.
3. Save the moment.
4. Edit or delete moments from the entries list menu.

## Files Structure

### Domain
- `js/domain/moment.js` - Moment model and formatting helpers

### Controller
- `js/controllers/moment-controller.js` - Create/edit moments (API-backed)

### Views
- `js/views/moment-view.js` - Modal UI
- `js/views/list-entries-view.js` - Renders moment cards in the timeline

### Data
- `js/data/storage.js` - API calls for `/api/moments/`

### Page
- `html/timer.html` - Log moment UI

## Data Model
```javascript
{
  id: string,
  description: string,
  category: string,
  timestampMs: number,
  taskId: string | null,
  taskTitle: string | null,
  isMilestone: boolean,
  createdAt: string
}
```

## Notes
- Backend uses ISO timestamps; the frontend converts to/from `timestampMs`.
