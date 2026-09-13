# 06: Study page core

**What to build:** A page where the user manages study items and logs prime/study interactions. Each item has a title, notes, category, and optional images. The user can filter by category with autocomplete. Pressing "Log Prime" or "Log Study" records the interaction with a timestamp. This ticket covers the core CRUD and interaction logging — spaced repetition and audio come in later tickets.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** done (2026-09-13 — backend commit 9b4ac70 + study page 8e2287d)

- [x] Study items list showing all items — ordered least-recently-touched first, never-touched at the top (spec story 52's All ordering)
- [x] Create study item: title, notes, category, optional image upload — image rides POST upload_image/ after the create settles
- [x] Edit study item — inline form via RowMenu; can also replace/remove the image
- [x] Archive/restore study items
- [x] Category filter: input that filters the list (prefix match, client-side)
- [x] Category autocomplete from existing categories (GET /api/study-items/categories/) — shared datalist for the filter and both forms
- [x] Log Prime button on each item: records prime interaction via POST /api/study-items/{id}/log_interaction/ with an explicit {"interaction": "prime"} body (backend extension; legacy body-less mode logging preserved)
- [x] Log Study button on items with notes (disabled if no notes; backend also 400s a study interaction without notes)
- [x] System records first-ever and most-recent dates for both prime and study — shown as a tooltip on each count
- [x] Optimistic UI on all mutations with rollback + error toast
- [x] Image display on study items
