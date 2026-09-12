import { apiFetch } from "./client";
import type { ActiveTimer } from "./types";

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
