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
