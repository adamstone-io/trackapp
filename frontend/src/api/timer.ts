import { ApiError, apiFetch } from "./client";
import type { ActiveTimer, TimeEntry } from "./types";

/** Payload for creating an active timer; the server assigns id/user/created_at. */
export interface ActiveTimerCreate {
  task_title: string;
  task: string | null;
  started_at: string;
  elapsed_seconds: number;
  is_paused: boolean;
  mode: "stopwatch" | "countdown";
  target_duration: number | null;
}

/** Returns the user's active timer, or null when none is running. */
export function getActiveTimer(): Promise<ActiveTimer | null> {
  return apiFetch<ActiveTimer | null>("/active-timer/");
}

export function createActiveTimer(payload: ActiveTimerCreate): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/active-timer/", { method: "POST", body: payload });
}

export function patchActiveTimer(patch: Partial<ActiveTimerCreate>): Promise<ActiveTimer> {
  return apiFetch<ActiveTimer>("/active-timer/", { method: "PATCH", body: patch });
}

export function deleteActiveTimer(): Promise<void> {
  return apiFetch<void>("/active-timer/", { method: "DELETE" });
}

/**
 * Stop the running session and record it, in one step the server performs
 * atomically. Resolves to null when there was nothing to stop — another tab,
 * or this one before a reload, already took it.
 *
 * Two requests (create the entry, then delete the timer) left a window in
 * which a second tab still saw a live session and recorded it again. The
 * server row is the only thing every tab shares, so it has to be the lock.
 */
export async function stopActiveTimer(endedAt: string): Promise<TimeEntry | null> {
  try {
    return await apiFetch<TimeEntry>("/active-timer/stop/", {
      method: "POST",
      body: { ended_at: endedAt },
    });
  } catch (error) {
    // The code, not the status: an API that has not yet been deployed with
    // this endpoint answers 404 as well, and reading that as "already
    // recorded" would throw the session away without a word.
    if (error instanceof ApiError && error.code === "no_active_timer") return null;
    throw error;
  }
}
