import type { Habit } from "../../api/types";

/** How many the dashboard falls back to when nothing has been picked. */
export const DEFAULT_DASHBOARD_HABITS = 3;

/**
 * Which habits the dashboard shows: the ones picked out for it, or — when
 * none have been — the first few registered.
 *
 * The fallback is what keeps the card from being empty on an account that has
 * never opened the habits page's menu, and "the oldest" is the only ordering
 * that does not change under the person as they log things.
 */
export function habitsForDashboard(habits: Habit[]): Habit[] {
  const active = habits.filter((habit) => habit.is_active);
  const picked = active.filter((habit) => habit.is_favorite);
  if (picked.length > 0) return picked;
  return [...active]
    .sort((a, b) => registeredMs(a) - registeredMs(b))
    .slice(0, DEFAULT_DASHBOARD_HABITS);
}

/** created_at is optional on the type; an absent one sorts oldest, which is
 * the same place an unsortable habit would sit in the list's own order. */
function registeredMs(habit: Habit): number {
  return habit.created_at ? Date.parse(habit.created_at) : 0;
}
