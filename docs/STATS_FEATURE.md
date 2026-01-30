# Stats Feature

## Overview
The Stats page summarizes time tracking and study activity for today, including
time entries, priming, and reviews.

## Metrics
- **Total time today** (sum of time entry durations)
- **Entries count** for today
- **Time by task** (sorted by total time)
- **Priming stats** (total, today, yesterday, week, last week)
- **Review stats** (total, today, this week, this month)

## Files Structure

### Controller
- `js/controllers/stats-controller.js` - Aggregates data from API

### View
- `js/views/stats-view.js` - Renders statistics

### Data
- `js/data/storage.js` - API list calls for entries, priming, and reviews

### Page
- `html/stats.html` - Stats page
- `js/stats-main.js` - Entry point

## Notes
- Stats are calculated client-side from API data.
- Today is based on local midnight to local midnight.
