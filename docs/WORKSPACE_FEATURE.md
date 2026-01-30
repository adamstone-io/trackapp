# Workspace Feature

## Overview
Workspace is where you manage projects and tasks. It also shows project-level
time totals and lets you jump directly into the timer with a task selected.

## Key Concepts
- **Project**: A container for tasks, with color and archive state.
- **Task**: A unit of work that can be scheduled or tracked.
- **Project Stats**: Aggregate time per project from entries.

## Usage Flow
1. Create or edit projects.
2. Add tasks (optionally assign to a project).
3. Start a task from workspace to open the timer with that task selected.
4. Archive or delete projects/tasks as needed.

## Files Structure

### Domain
- `js/domain/project.js` - Project model
- `js/domain/task.js` - Task model

### Controller
- `js/controllers/workspace-controller.js` - Project/task CRUD and stats

### View
- `js/views/workspace-view.js` - Workspace UI and modals

### Data
- `js/data/storage.js` - API calls for projects, tasks, and entries

### Page
- `html/workspace.html` - Workspace page
- `js/workspace-main.js` - Entry point

## Notes
- Data is API-backed via `/api/projects/` and `/api/tasks/`.
