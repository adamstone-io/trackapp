import { apiFetch } from "./client";
import type { DayStats, PeriodStats, StatsPeriod } from "./types";

export function getPeriodStats(period: StatsPeriod): Promise<PeriodStats> {
  return apiFetch<PeriodStats>(`/stats/?period=${period}`);
}

/** The last `days` days, oldest first, with a row for every day. */
export async function getDailyStats(days: number): Promise<DayStats[]> {
  const data = await apiFetch<{ days: DayStats[] }>(`/stats/daily/?days=${days}`);
  return data.days;
}
