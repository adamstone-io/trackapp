import { apiFetch } from "./client";
import type { Habit } from "./types";

interface HabitPage {
  next: string | null;
  results: Habit[];
}

export async function listAllHabits(): Promise<Habit[]> {
  const habits: Habit[] = [];
  for (let page = 1; ; page++) {
    const data = await apiFetch<HabitPage>(`/habits/?page=${page}`);
    habits.push(...data.results);
    if (!data.next) return habits;
  }
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

/** Back-fill a log for a past date ("YYYY-MM-DD" in the user's timezone). */
export function backfillHabit(id: string, date: string): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/log/`, { method: "POST", body: { date, amount: 1 } });
}

export type HabitPatch = Partial<
  Pick<Habit, "name" | "daily_target" | "weekly_target" | "monthly_target" | "is_active">
>;

export function patchHabit(id: string, patch: HabitPatch): Promise<Habit> {
  return apiFetch<Habit>(`/habits/${id}/`, { method: "PATCH", body: patch });
}
