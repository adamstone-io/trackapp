# 05: Projects & Workspace page

**What to build:** A workspace page where the user creates and manages projects and tasks. Projects have a name, description, and color. Tasks can optionally belong to a project. Deleting a project leaves its tasks unassigned. The user can see total tracked time per task and per project.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** done (2026-09-13 — backend commit 1c81ce5 + workspace page 854d131, review fixes db4ea31)

- [x] Workspace page layout — ProjectSection + TaskSection in features/workspace/
- [x] Project CRUD: create (name, description, color), edit, delete — color via 8-swatch picker
- [x] Deleting a project unassigns its tasks (does not delete them) — backend SET_NULL, pinned by ProjectDeleteTests; the tasks cache mirrors it optimistically
- [x] Archive/restore projects
- [x] Task CRUD: create (title, category, optional project), edit, delete — task delete cascades its time entries (warned inline; decision point filed as ticket 05.1)
- [x] Archive/restore tasks
- [x] Total tracked time displayed per task and per project (from backend annotations) — GET /projects/ gained a total_seconds annotation; task totals Coalesce'd to 0
- [x] Optimistic UI on all mutations with rollback + error toast
- [x] Project color displayed as visual indicator — dot on project rows and task project chips
