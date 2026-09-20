# 22: Archived things live off the page

**What to build:** every page put its retired rows in a section under the live
list. Under `fetchAllPages` that section was buried below thousands of rows and
nobody reached it; once the study list paged twenty at a time (06.9) it landed
directly under the first screenful, and the same was true of the workspace and
habits, whose lists were always short.

06.10 and `0c09deb` folded those sections behind a collapsed toggle. That was
the wrong shape: a thing you go looking for does not belong on the page it is
absent from.

**Owner decision (2026-09-21):** a `⋮` at the top of each page, with an
"Archived" item leading to that feature's own archived page — one per feature,
not one shared page, so the way in is contextual. Archived rows offer restore
**and a permanent delete**, which relaxes the repo's "never hard delete user
data" rule for rows that are already archived. CLAUDE.md updated to say so.

**Blocked by:** 06.9, 06.10 — done

**Status:** done (2026-09-21)

- [x] `components/Menu` owns the dropdown — trigger, panel, confirm two-step,
      focus and dismissal — with `RowMenu` and `PageMenu` as the two names for
      it, rather than the behaviour written twice
- [x] `components/ArchivedView` is the shared archived page body: restore, and
      a permanent delete behind the confirm step that names what it costs
- [x] `/study/archived`, `/workspace/archived`, `/habits/archived`, each
      reached from its page's `PageMenu` and each with a way back
- [x] The study archive pages as you scroll, like the live list — an archive
      grows without limit (R31x)
- [x] The inline archived sections and the collapsed toggles are gone from
      `StudySection`, `ProjectSection` and `HabitList`; the study page no
      longer fetches the archived side at all
- [x] `DELETE /study-items/{id}/` wired up (the viewset already allowed it);
      projects and habits already had theirs
- [x] CLAUDE.md records both new rules: where archived things live, and the
      one place a permanent delete is offered

**Not done here:** no undo on the permanent delete. The confirm step and the
note are what stands between a row and oblivion, which is the same protection
the workspace's project delete has always had.
