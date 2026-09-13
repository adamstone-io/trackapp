# 15: Midnight rollover

**What to build:** Automatic day-change detection so the app always shows current-day data. When midnight passes in the user's timezone, all day-dependent data refreshes without a manual reload. If the device was asleep at midnight, it catches up on wake. Satisfies requirement R33e (added 2026-09-13).

**Blocked by:** 02 (Timer page)

**Status:** deferred — after the portfolio MVP (2026-09-13, owner)

**Why:** wanted, not dropped. The owner's priority is a showable MVP; this
comes off the back burner once that ships. Distinct from ticket 08's old
wontfix: nothing here has been decided against.

- [ ] On app load, calculate milliseconds until midnight in the user's timezone
- [ ] Set a setTimeout that fires at midnight
- [ ] On fire: invalidate all TanStack Query caches for day-dependent data (today's entries, habits, stats, scheduled tasks)
- [ ] After invalidation, set a new timeout for the next midnight
- [ ] visibilitychange listener: when tab becomes visible, check if the date has changed since last check; if so, invalidate day-dependent caches
- [ ] Works correctly across DST transitions
