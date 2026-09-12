import { apiFetch, fetchAllPages } from "./client";
import type { Task } from "./types";

function listAllTasks(): Promise<Task[]> {
  return fetchAllPages<Task>("/tasks/");
}

function createTask(title: string): Promise<Task> {
  return apiFetch<Task>("/tasks/", { method: "POST", body: { title } });
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
  return (await createTask(title)).id;
}
