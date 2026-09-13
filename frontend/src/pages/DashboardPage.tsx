import { useState } from "react";
import { PageShell } from "../components/PageShell";
import type { StatsPeriod } from "../api/types";
import { useHabitsQuery } from "../features/habits/useHabits";
import { useDailyStatsQuery, usePeriodStatsQuery } from "../features/dashboard/useStats";
import { TimeComparison } from "../features/dashboard/TimeComparison";
import { DailyTrend } from "../features/dashboard/DailyTrend";
import { PeriodPicker } from "../features/dashboard/PeriodPicker";
import { TopTasks } from "../features/dashboard/TopTasks";
import { ActivityCounts } from "../features/dashboard/ActivityCounts";
import { HabitChains } from "../features/dashboard/HabitChains";
import { TodaysPlan } from "../features/dashboard/TodaysPlan";
import { useScheduledTasksQuery } from "../features/scheduledTasks/useScheduledTasks";
import { toIsoDay } from "../lib/time";

/** The trend window. Two weeks is long enough to show a rhythm and short
 * enough to draw as one column per day on a phone. */
const TREND_DAYS = 14;

export function DashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>("today");
  const { data: days } = useDailyStatsQuery(TREND_DAYS);
  const { data: stats } = usePeriodStatsQuery(period);
  const { data: habits } = useHabitsQuery();
  const { data: planned } = useScheduledTasksQuery(toIsoDay(new Date()));

  return (
    <PageShell>
      {days && (
        <>
          <TimeComparison days={days} />
          <DailyTrend days={days} />
        </>
      )}
      {planned && <TodaysPlan tasks={planned} />}
      <PeriodPicker period={period} onChange={setPeriod} />
      {stats && (
        <>
          <TopTasks stats={stats} />
          <ActivityCounts stats={stats} />
        </>
      )}
      {habits && <HabitChains habits={habits} />}
    </PageShell>
  );
}
