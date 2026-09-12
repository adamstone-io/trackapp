# 14: Settings page (export/import)

**What to build:** A settings page where the user can export all their data as a JSON file and import a previously exported backup. The backend wraps the existing management commands as API endpoints.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** ready-for-agent

- [ ] Backend: export API endpoint — returns all user data as JSON (wraps backup_data logic)
- [ ] Backend: import API endpoint — accepts JSON file, upserts records without duplicates, respects dependency order (projects → tasks → entries)
- [ ] Backend: import never overwrites one user's data with another's
- [ ] Frontend: settings page at /settings
- [ ] Frontend: download button that triggers export and saves JSON file
- [ ] Frontend: file upload input for importing a JSON backup
- [ ] Frontend: success/error feedback on import (toast)
- [ ] Frontend: account info display (email, trial status)
