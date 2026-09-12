# 06: Study page core

**What to build:** A page where the user manages study items and logs prime/study interactions. Each item has a title, notes, category, and optional images. The user can filter by category with autocomplete. Pressing "Log Prime" or "Log Study" records the interaction with a timestamp. This ticket covers the core CRUD and interaction logging — spaced repetition and audio come in later tickets.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** ready-for-agent

- [ ] Study items list showing all items
- [ ] Create study item: title, notes, category, optional image upload
- [ ] Edit study item
- [ ] Archive/restore study items
- [ ] Category filter: dropdown or input that filters the list
- [ ] Category autocomplete from existing categories (GET /api/study-items/categories/)
- [ ] Log Prime button on each item: records prime interaction via POST /api/study-items/{id}/log_interaction/
- [ ] Log Study button on items with notes (absent/disabled if no notes)
- [ ] System records first-ever and most-recent dates for both prime and study
- [ ] Optimistic UI on all mutations with rollback + error toast
- [ ] Image display on study items
