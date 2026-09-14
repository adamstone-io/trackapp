# 07: Dashboard

**What to build:** One page showing time tracked, habits, and study activity —
with a period selector (today, yesterday, this week, this month) rather than a
separate stats page. All period boundaries computed in the user's timezone.

**Scope change (2026-09-13, from the owner):** there is no separate /stats page.
A dashboard and a stats page showing the same aggregates, one of them with a
date picker, is one page. The period selector moves here, so R31/R32 are still
met. The scheduled-tasks section is gone with ticket 08.

**Blocked by:** 02 (Timer page), 04 (Habits page), 06 (Study page core)

**Status:** done (2026-09-13/14 — acc657e, then the owner's revisions through
bf6e4ed: ordering, the green chain, today-vs-yesterday study counts)

- [x] Dashboard page (/ route) with a period selector: today, yesterday, this
      week, this month — defaulting to today
- [x] Total time tracked for the period, broken down by task
- [x] Prime/study interaction counts for the period
- [x] Habits compact display: daily count, weekly count, current streak per habit
- [x] All period boundaries use the x-user-timezone header, computed by backend
- [x] Data from GET /api/stats/ and GET /api/today-entries/ — check /api/stats/
      actually supports all four periods before assuming it
- [x] No /stats route; anything pointing at it is removed

**Built beyond the list**, at the owner's request during the ticket: today
against yesterday with the gap stated (R31b), a fortnight trend (R31d), the
five top tasks as a bar chart with the period's total (R31a), entries against
moments (R31c), habit *chains* rather than compact counters (R21a — habits had
no per-day history, so `Habit.completed_dates` was added for it), today's plan
(R33b), and priming/studying today against yesterday at the top of the page.
