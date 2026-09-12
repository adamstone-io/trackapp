# 16: Edit times on logged moments + time entries

**What to build:** Inline time editing in the day log, matching the legacy app: change a moment's timestamp, and change a time entry's start/end times (duration recomputes from the new times). Satisfies requirements R9f and R17b in the Obsidian requirements list (`02-requirements.md`).

**Blocked by:** 02 (Timer page), 03 (Moments)

**Status:** ready-for-agent

> Legacy reference: `frontend/js/controllers/list-entries-controller.js` —
> `startMomentTimeEdit` (line ~466) and `startTimeEdit` (line ~648). The legacy
> client recomputes `duration_seconds` itself; the backend stores duration
> explicitly and does not derive it.

- [ ] Moment row: click the time in the log to edit it inline (time input); commits PATCH `{timestamp}` optimistically with rollback + toast (reuse `useEditMoment`)
- [ ] Time entry row: click the time range to edit start and end inline; commits PATCH `{started_at, ended_at, duration_seconds}` optimistically with rollback + toast
- [ ] Duration recomputed client-side from the edited start/end; reject (or clamp) end before start
- [ ] Edited times stay within the current day’s log semantics (the log re-sorts if ordering changes)
- [ ] Unsettled optimistic rows (no server id yet) are not editable, same as rename/category
