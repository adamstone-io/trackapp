# 07: Dashboard + Stats pages

**What to build:** A dashboard showing today's summary at a glance — time tracked, habits status, and study activity. A separate stats page with a period selector for deeper analysis. All period boundaries computed in the user's timezone.

**Blocked by:** 02 (Timer page), 04 (Habits page), 06 (Study page core)

**Status:** ready-for-agent

- [ ] Dashboard page (/ route): today's total time tracked, breakdown by task
- [ ] Habits compact display on dashboard: daily count, weekly count, current streak per habit
- [ ] Study interaction counts on dashboard (prime/study today)
- [ ] Stats page (/stats route): period selector (today, yesterday, this week, this month)
- [ ] Stats: total time and breakdown by task for selected period
- [ ] Stats: prime/study interaction counts for selected period
- [ ] All period boundaries use x-user-timezone header, computed by backend
- [ ] Data from GET /api/stats/ and GET /api/today-entries/
- [ ] Placeholder section for scheduled tasks (filled in by ticket 08)
