# 21: ensureTaskId downloads every task to find one row

**What to fix:** `ensureTaskId` resolves a task title to a task id by fetching
the user's entire task collection and searching it in the browser:

```ts
// frontend/src/api/tasks.ts:22
const existing = (await listAllTasks()).find(
  (task) => task.title.trim().toLowerCase() === normalized && (task.project ?? null) === project,
);
```

`listAllTasks` (`frontend/src/api/tasks.ts:4`) uses `fetchAllPages`, which walks
`?page=N` sequentially until the server reports no `next` — about 15 round
trips at the ~287 tasks in production, each waiting on the last, to find one
row. Every one of those pages also annotates each row with
`Count("time_entries")`, `Sum("time_entries__duration_seconds")` and
`Min("time_entries__started_at")` (`TaskViewSet.get_queryset`).

It runs on the three commonest actions in the app: starting a timer
(`features/timer/useActiveTimer.ts:87`), saving a time entry
(`features/timer/useTimeEntries.ts:42`), and editing an entry's title
(`features/timer/useTimeEntries.ts:208`). Those paths are optimistic, so it is
mostly invisible today — but the active-timer POST waits on it, and the
round-trip count grows with the collection, one task per distinct title ever
tracked.

Same shape as the study list in 06.9, smaller in magnitude, and the fix is a
different kind: not paging, but not fetching a collection to find one row in it.

**How to fix it:** add a title lookup to the tasks endpoint and call it.

Exact match is right, not `iexact`: titles have been stored normalised
lowercase since eb523b5 and migration `0017_lowercase_titles`, and
`normalize_title` (`backend/tracker/serializers.py:27`) is
`(value or "").strip().lower()` — the same normalisation the client already
applies before comparing.

**Blocked by:** nothing

**Status:** ready

- [ ] `TaskViewSet.get_queryset` accepts a `title` query param as an exact match
- [ ] Project scoping matches the client's rule, including the unassigned case:
      no `project` means `project__isnull=True`, which must stay distinct from
      "any project" or work already logged gets pulled into one
- [ ] `ensureTaskId` makes one request, keeping its create-if-missing fallback
- [ ] `listAllTasks` has no callers left and goes with it
- [ ] Django test: the filter returns only the match; project scoping separates
      same-titled tasks; an unassigned task is not returned when a project is named
- [ ] Vitest: starting a timer for an existing title issues one task request,
      not a page walk

**Out of scope:** `fetchAllPages` also backs `listAllProjects` (2 rows) and
`listAllHabits` (13 rows). Both fit in one page, so the loop exits immediately —
leave them. `listScheduledTasks` is scoped to a single day and is fine too.
