import { apiFetch, fetchAllPages } from "./client";
import type { Task } from "./types";

export function listAllTasks(): Promise<Task[]> {
  return fetchAllPages<Task>("/tasks/");
}

export interface TaskCreate {
  title: string;
  category?: string;
  project?: string | null;
}

export function createTask(payload: TaskCreate): Promise<Task> {
  return apiFetch<Task>("/tasks/", { method: "POST", body: payload });
}

export type TaskPatch = Partial<Pick<Task, "title" | "category" | "project" | "archived">>;

export function patchTask(id: string, patch: TaskPatch): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/`, { method: "PATCH", body: patch });
}

/** Permanent delete. The backend cascades the task's time entries away. */
export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}/`, { method: "DELETE" });
}

/**
 * Time entries need a task FK. Reuse an existing task whose title matches
 * (case-insensitive), otherwise create one — same rule as the legacy app.
 */
export async function ensureTaskId(title: string): Promise<string> {
  const normalized = title.trim().toLowerCase();
  const existing = (await listAllTasks()).find(
    (task) => task.title.trim().toLowerCase() === normalized,
  );
  if (existing) return existing.id;
  return (await createTask({ title })).id;
}
