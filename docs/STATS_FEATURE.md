# Stats & Dashboard Feature

## Overview
The dashboard is the app's landing page (`/`): how today compares with
yesterday, what the last fortnight looked like, what is scheduled for today,
where the time and attention went over a chosen period, and how each habit's
chain is holding.

## What it shows
- **Time tracked** — today's total beside yesterday's, with the gap stated
  ("32m more than yesterday"). R31b.
- **Study** — priming and studying, today against yesterday, abreast of the
  time tracked. Two pairs of columns under one scale, so priming is comparable
  with studying and not only with its own day. Pinned to those two days
  whatever the period selector says; when the selector is on Today or Yesterday
  it shares that query rather than making a second one. R32.
- **Last 14 days** — one column per day of tracked time, today in accent. R31d.
- **Today's plan** — the day's scheduled tasks, earliest first; a task already
  started reads muted. R33b.
- **Top tasks** — the period's total, and the five tasks with the most time in
  it. R31, R31a.
- **Activity** — entries, moments, primes and studies as one bar chart. R31c, R32.
- **Habit streaks** — every active habit's recent days drawn as a chain, with
  the current run stated as a streak. R21a, R33a.

Order down the page: the two day-scoped cards abreast at the top, then the
habit streaks, then the period block (selector, Top tasks, Activity), then
today's plan, with the fortnight trend last.

The period selector (Today / Yesterday / This week / This month) governs the
Top tasks and Activity cards only, and travels directly above them; every other
card is day-scoped and ignores it.

## API

### `GET /api/stats/?period=today|yesterday|this_week|this_month`
One period's summary:

```json
{
  "period": "today",
  "total_seconds": 11520,
  "entry_count": 6,
  "moment_count": 2,
  "by_task": [{"title": "Write", "total_seconds": 7200, "entry_count": 3}],
  "prime_count": 40,
  "study_count": 7,
  "review_count": 0
}
```

`by_task` comes back longest-first; the dashboard takes the top five.

### `GET /api/stats/daily/?days=N`
A per-day series of tracked time, oldest first, with a row for every day whether
anything happened on it or not. `days` defaults to 14 and is clamped to 1–90.
Counts spanning a whole period (moments, primes, studies) belong to the period
endpoint above, not here.

```json
{"days": [{"date": "2026-09-13", "total_seconds": 3600, "entry_count": 2}]}
```

Both endpoints cut days at midnight in the `X-User-Timezone` timezone, never
UTC. The period endpoint's study counts come from the `prime_timestamps` /
`study_timestamps` history arrays, which hold either epoch values or ISO
strings — both are read.

## Frontend
- `src/pages/DashboardPage.tsx` — composes the cards, owns the period state
- `src/features/dashboard/` — `TimeComparison`, `DailyTrend`, `TodaysPlan`,
  `PeriodPicker`, `TopTasks`, `ActivityCounts`, `HabitChains`, and the shared
  `Card` / `BarList` primitives
- `src/features/dashboard/useStats.ts` — the two TanStack Query reads
- Charts are hand-rolled CSS (flex tracks and percentage fills) — no chart
  dependency.

## Notes
- The dashboard reads only; every mutation lives on the feature pages. Its two
  stats queries carry `staleTime: 0`, so every visit re-reads rather than
  showing numbers another page has since moved.
- Tests: `src/pages/DashboardPage.test.tsx` (MSW), `StatsPeriodTests` and
  `DailyStatsTests` in `backend/tracker/tests.py`.
