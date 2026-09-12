# 03: Moments (in the timer day log)

> **Scope change (2026-09-12):** there is no standalone /moments page. Moment
> capture and the moment list live on the /timer page, rendered in the same
> day log as time entries (per spec user story 11). The /moments route and nav
> link were removed from the scaffold.

**What to build:** Moment capture UI on the timer page: the user captures timestamped thoughts with one button press. Moments appear instantly (optimistic UI) in the shared day log alongside time entries. The user can edit or delete moments after creation. Text-only — voice moments come in a later ticket.

**Blocked by:** 01 (Scaffold + Auth + Design system)

**Status:** done (2026-09-12 — category editing landed; delete remains with ticket 13)

> **Reconciled 2026-09-12:** ticket 02's follow-ups built most of this ahead of
> schedule (commits 6656d22, 4de0216, 599d1a5). What's already on the branch:
> moments render in the day log (`TodayLog`), "Add moment" next to "Add entry"
> converts the timer task-title field's text (or "Untitled") into a moment, and
> moment text is click-to-rename inline. Mutations live in
> `web/src/features/timer/useTimeEntries.ts` (`useAddMoment`, `useRenameMoment`),
> API calls in `web/src/api/entries.ts`. Remaining work should follow the same
> optimistic pattern and reuse `EditableText` / the toast where sensible.

- [x] Moments list showing all moments, most recent first — in the shared day log via GET /api/today-entries/ (ticket 02, commit fdfdb7f)
- [x] One-button moment log: uses text from input field (or "Untitled"), records current timestamp — AddMomentButton (6656d22, 4de0216)
- [x] Optimistic create: moment appears in list immediately (6656d22)
- [x] Edit moment (description, category) — description via inline rename (4de0216); category via a click-to-edit chip on the moment row (select with the legacy category set, optimistic PATCH; `useEditMoment` generalizes the old rename hook)
- [x] ~~Delete moment with optimistic removal~~ — **moved to ticket 13**, which owns archive/delete for both moments and time entries (repo rule: never hard delete, archive instead; Moment lacks the archived field until 13's backend work)
- [x] Rollback + error toast on server rejection for all mutations — done for create + rename (delete's arrives with ticket 13)
- [x] Moment data via GET/POST/PATCH /api/moments/ — GET (via today-entries), POST, PATCH done; DELETE deferred to ticket 13
