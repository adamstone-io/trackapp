# 16: Edit times on logged moments + time entries

**What to build:** Inline time editing in the day log, matching the legacy app: change a moment's timestamp, and change a time entry's start/end times (duration recomputes from the new times). Satisfies requirements R9f and R17b in the Obsidian requirements list (`02-requirements.md`).

**Blocked by:** 02 (Timer page), 03 (Moments)

**Status:** done (2026-09-13)

> Legacy reference: `frontend/js/controllers/list-entries-controller.js` —
> `startMomentTimeEdit` (line ~466) and `startTimeEdit` (line ~648). The legacy
> client recomputes `duration_seconds` itself; the backend stores duration
> explicitly and does not derive it.

- [x] Moment row: click the time in the log to edit it inline (time input); commits PATCH `{timestamp}` optimistically with rollback + toast (reuse `useEditMoment`)
- [x] Time entry row: click the time range to edit start and end inline; commits PATCH `{started_at, ended_at, duration_seconds}` optimistically with rollback + toast
- [x] Duration recomputed client-side from the edited start/end; reject (or clamp) end before start
- [x] Edited times stay within the current day’s log semantics (the log re-sorts if ordering changes)
- [x] Unsettled optimistic rows (no server id yet) are not editable, same as rename/category

**As built:** the time range on an entry row and the time on a moment row are
click-to-edit, and both rows' ⋮ menus gained a matching item (Times / Time) —
same twin-affordance rule the title already follows. `useRenameTimeEntry` was
generalised to `useEditTimeEntry({id, patch})`, mirroring `useEditMoment`, and
editing a start time also moves the row's `sort_time` so the log re-sorts.
Duration is recomputed client-side, as the ticket says; an end before the start
is refused with a toast rather than clamped.

**Known limit:** an entry carrying `breaks` would have that time folded back
into its duration, since the recompute is simply end − start. Nothing in the
React app creates breaks yet — that's ticket 02.1, which should handle it.
