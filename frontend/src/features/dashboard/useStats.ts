import { useQuery } from "@tanstack/react-query";
import { getDailyStats, getPeriodStats } from "../../api/stats";
import type { StatsPeriod } from "../../api/types";

const STATS_KEY = ["stats"];

/** Re-read on every visit: the numbers move whenever another page logs
 * something, and a stale dashboard is a wrong dashboard. */
const ALWAYS_FRESH = { staleTime: 0 };

export function useDailyStatsQuery(days: number) {
  return useQuery({
    queryKey: [...STATS_KEY, "daily", days],
    queryFn: () => getDailyStats(days),
    ...ALWAYS_FRESH,
  });
}

export function usePeriodStatsQuery(period: StatsPeriod) {
  return useQuery({
    queryKey: [...STATS_KEY, "period", period],
    queryFn: () => getPeriodStats(period),
    ...ALWAYS_FRESH,
  });
}
