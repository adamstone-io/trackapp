import { apiFetch, fetchAllPages } from "./client";
import type { Habit } from "./types";

export function listAllHabits(): Promise<Habit[]> {
  return fetchAllPages<Habit>("/habits/");
}

export interface HabitCreate {
  name: string;
  daily_target: number;
  weekly_target: number;
  monthly_target: number;
}

export function createHabit(payload: HabitCreate): Promise<Habit> {
  return apiFetch<Habit>("/habits/", { method: "POST", body: payload });
}

/** One log action; the backend updates all three counters and the streak. */
export function logHabit(id: string): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/log/`, { method: "POST", body: {} });
}

/** Remove a mistaken log: the backend decrements all three counters. */
export function unlogHabit(id: string): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/unlog/`, { method: "POST", body: {} });
}

/** Back-fill a log for a past date ("YYYY-MM-DD" in the user's timezone).
 * The amount is the whole day's count — it must reach the daily target on
 * its own for the day to earn a streak credit. */
export function backfillHabit(id: string, date: string, amount: number): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/log/`, { method: "POST", body: { date, amount } });
}

export type HabitPatch = Partial<
  Pick<
    Habit,
    | "name"
    | "daily_target"
    | "weekly_target"
    | "monthly_target"
    | "is_active"
    | "is_favorite"
  >
>;

export function patchHabit(id: string, patch: HabitPatch): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/`, { method: "PATCH", body: patch });
}

/** Permanent delete — the habit's counters and streak go with it. */
export function deleteHabit(id: string): Promise<void> {
  return apiFetch<void>(`/habits/${id}/`, { method: "DELETE" });
}
