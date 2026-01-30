# Data Management Feature

## Overview
Data management provides export/import and local clear actions for your data.

## Features
- **Export**: Download a JSON backup from API-backed data.
- **Import**: Upload a JSON backup and upsert data into the API.
- **Clear local data**: Clears localStorage only (does not delete API data).

## Files Structure

### Controller
- `js/controllers/data-management-controller.js` - Menu actions

### Data
- `js/data/storage.js` - `exportAllData` and `importAllData`

## Export Format
The export JSON includes:
- `moments`, `tasks`, `projects`, `timeEntries`
- `primeItems`, `reviewItems`, `habits`
- `exportedAt`

## Notes
- Import uses id-based upsert: update if id exists, create if not.
- Projects and tasks are imported before entries to preserve relations.
