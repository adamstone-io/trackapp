# 07: Dashboard

**What to build:** One page showing time tracked, habits, and study activity —
with a period selector (today, yesterday, this week, this month) rather than a
separate stats page. All period boundaries computed in the user's timezone.

**Scope change (2026-09-13, from the owner):** there is no separate /stats page.
A dashboard and a stats page showing the same aggregates, one of them with a
date picker, is one page. The period selector moves here, so R31/R32 are still
met. The scheduled-tasks section is gone with ticket 08.

**Blocked by:** 02 (Timer page), 04 (Habits page), 06 (Study page core)

**Status:** ready-for-agent

- [ ] Dashboard page (/ route) with a period selector: today, yesterday, this
      week, this month — defaulting to today
- [ ] Total time tracked for the period, broken down by task
- [ ] Prime/study interaction counts for the period
- [ ] Habits compact display: daily count, weekly count, current streak per habit
- [ ] All period boundaries use the x-user-timezone header, computed by backend
- [ ] Data from GET /api/stats/ and GET /api/today-entries/ — check /api/stats/
      actually supports all four periods before assuming it
- [ ] No /stats route; anything pointing at it is removed
