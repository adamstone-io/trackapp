# 18: A timer started on one device shows up on the others

**What to build:** R9c — a timer started anywhere is reflected everywhere within
two seconds. Today the active timer is fetched once at page load (R7), so a
timer started on a phone is invisible on a desktop tab until it's reloaded.
This was listed in traceability.md as a requirement with no ticket.

**Approach — polling, not push.** Real-time push would need ASGI + Channels +
Redis; this project runs Gunicorn sync workers and has no queue or broker, and
the repo's rules say to flag infrastructure like that rather than add it. A 2s
poll on one small endpoint meets the requirement without any of it. If the app
ever grows a realtime layer, this is the thing to replace.

**Blocked by:** 02 (Timer page) — done

**Status:** done (2026-09-13)

- [x] The active timer is polled every 2s, so a timer started elsewhere appears
- [x] Polling pauses while the tab is hidden — no work for a tab nobody sees
- [x] Polling pauses while a timer mutation is in flight, so a poll in flight
      can't rewind an optimistic pause/resume/stop
- [x] A timer stopped elsewhere clears here, and the day's log refreshes so the
      entry it produced appears
- [x] The running readout doesn't jump when a poll lands

**As built:** `useActiveTimerQuery` polls every 2s with `staleTime: 0`;
`refetchIntervalInBackground` stays false, so a hidden tab is silent. Every
timer mutation shares `TIMER_MUTATION_KEY` and polling stands down while one is
in flight. `useTimerSync()` (mounted once in AppLayout) refetches the day's log
when the timer disappears — but a stop *here* calls `markLocalTimerStop()` from
its onMutate, because that path already writes its own optimistic entry and a
refetch over it would wipe the row. Inferring locality from `useIsMutating`
was tried first and is too dependent on render timing.

**Watch for:** test mocks that answer `GET /active-timer/` with a timer the
server has already deleted now resurrect it, because the app polls. Mocks have
to behave like the server.
