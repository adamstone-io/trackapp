# 13: Archive/delete for TimeEntry + Moment

**What to build:** Soft-delete (archive) and permanent delete for time entries and moments. Archive is the default action; permanent delete requires explicit confirmation. Archived items can be restored.

**Blocked by:** 02 (Timer page), 03 (Moments page)

**Status:** ready-for-agent

- [ ] Backend: add archived boolean field (default=False) to TimeEntry model
- [ ] Backend: add archived boolean field (default=False) to Moment model
- [ ] Backend: archive/unarchive actions on TimeEntryViewSet and MomentViewSet
- [ ] Backend: today-entries and stats endpoints exclude archived records
- [ ] Frontend: archive button on time entries (soft delete)
- [ ] Frontend: archive button on moments (soft delete)
- [ ] Frontend: permanent delete option with confirmation dialog
- [ ] Frontend: restore (unarchive) action
- [ ] Frontend: way to view archived items
- [ ] Optimistic UI on archive/delete/restore with rollback + error toast
