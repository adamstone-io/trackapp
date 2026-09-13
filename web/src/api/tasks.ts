import { apiFetch, fetchAllPages } from "./client";
import type { Task } from "./types";

function listAllTasks(): Promise<Task[]> {
  return fetchAllPages<Task>("/tasks/");
}

function createTask(title: string, project: string | null): Promise<Task> {
  return apiFetch<Task>("/tasks/", { method: "POST", body: { title, project } });
}

/**
 * Time entries need a task FK. Reuse an existing task whose title matches
 * (case-insensitive), otherwise create one — same rule as the legacy app.
 *
 * The match is scoped to the project: the same title tracked under two
 * projects is two tasks, which is what keeps each project's total honest.
 * Unassigned work keeps matching unassigned tasks, so nothing already logged
 * is retroactively pulled into a project.
 */
export async function ensureTaskId(title: string, project: string | null = null): Promise<string> {
  const normalized = title.trim().toLowerCase();
  const existing = (await listAllTasks()).find(
    (task) => task.title.trim().toLowerCase() === normalized && (task.project ?? null) === project,
  );
  if (existing) return existing.id;
  return (await createTask(title, project)).id;
}

export interface ScheduledTaskCreate {
  title: string;
  project: string | null;
  notes: string;
  /** ISO timestamp of the planned start. */
  planned_start: string;
  /** Planned length in seconds (legacy unit). */
  planned_duration: number | null;
}

export type ScheduledTaskPatch = Partial<ScheduledTaskCreate & { archived: boolean }>;

/** One day's scheduled tasks, ascending by planned start (R63, R63a). */
export function listScheduledTasks(date: string): Promise<Task[]> {
  return fetchAllPages<Task>(`/tasks/?planned_date=${date}`);
}

export function createScheduledTask(payload: ScheduledTaskCreate): Promise<Task> {
  return apiFetch<Task>("/tasks/", { method: "POST", body: payload });
}

export function patchTask(id: string, patch: ScheduledTaskPatch): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/`, { method: "PATCH", body: patch });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}/`, { method: "DELETE" });
}
