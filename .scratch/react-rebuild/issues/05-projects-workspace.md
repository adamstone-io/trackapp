# 05: Projects & Workspace page

**What to build:** A workspace page where the user creates and manages projects and tasks. Projects have a name, description, and color. Tasks can optionally belong to a project. Deleting a project leaves its tasks unassigned. The user can see total tracked time per task and per project.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** ready-for-agent

- [ ] Workspace page layout
- [ ] Project CRUD: create (name, description, color), edit, delete
- [ ] Deleting a project unassigns its tasks (does not delete them)
- [ ] Archive/restore projects
- [ ] Task CRUD: create (title, category, optional project), edit, delete
- [ ] Archive/restore tasks
- [ ] Total tracked time displayed per task and per project (from backend annotations)
- [ ] Optimistic UI on all mutations with rollback + error toast
- [ ] Project color displayed as visual indicator
