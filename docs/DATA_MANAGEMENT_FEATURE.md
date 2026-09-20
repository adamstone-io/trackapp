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


## Moving study items between deployments

`backup_data` writes database rows only. An `ImageField` stores a path, never
the bytes, so restoring that backup onto a fresh disk gives intact-looking rows
whose images 404. Two commands carry both:

```bash
# On the deployment that has the data:
python backend/manage.py export_study_items --out ./study-bundle

# Database remote, files not (a local Django pointed at a production
# DATABASE_URL) — fetch the images over HTTPS from the site's own /media/ URLs:
python backend/manage.py export_study_items --out ./study-bundle \
    --media-base https://bitadam.net

# On the deployment that needs it:
python backend/manage.py import_study_items --from ./study-bundle --dry-run
python backend/manage.py import_study_items --from ./study-bundle
```

The bundle is a directory: `study_items.json` plus `media/` holding the files
at the same relative paths the rows record.

- Rows match on their **UUID**, so a second run updates rather than duplicates
  and an item keeps the identity it had on the deployment it came from.
- Accounts match on **username**, because user ids differ between deployments.
  `--user NAME` redirects the whole import onto one account.
- Notes, categories, prime/study counts and the timestamp histories all travel.
- An image the bundle could not collect is reported at export time and again at
  import; the row still lands, without the picture.

**`import_data` is broken** and has been for some time: it imports `PrimeItem`
and `ReviewItem`, models merged into `StudyItem`, so it raises `ImportError`
before it starts. It covers projects, tasks, time entries and moments; those
have no working import path today.
