import { apiFetch, fetchAllPages } from "./client";
import type { Project } from "./types";

export function listAllProjects(): Promise<Project[]> {
  return fetchAllPages<Project>("/projects/");
}

export interface ProjectCreate {
  name: string;
  description: string;
  color: string;
}

export function createProject(payload: ProjectCreate): Promise<Project> {
  return apiFetch<Project>("/projects/", { method: "POST", body: payload });
}

export type ProjectPatch = Partial<Pick<Project, "name" | "description" | "color" | "archived">>;

export function patchProject(id: string, patch: ProjectPatch): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/`, { method: "PATCH", body: patch });
}

/** Permanent delete. The backend unassigns the project's tasks (SET_NULL). */
export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}/`, { method: "DELETE" });
}
