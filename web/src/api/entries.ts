import { apiFetch } from "./client";
import type { Moment, TimeEntry, TodayEntry } from "./types";

export function getTodayEntries(): Promise<TodayEntry[]> {
  return apiFetch<TodayEntry[]>("/today-entries/");
}

export interface TimeEntryCreate {
  task: string;
  task_title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  notes: string;
  breaks: unknown[];
}

export function createTimeEntry(payload: TimeEntryCreate): Promise<TimeEntry> {
  return apiFetch<TimeEntry>("/time-entries/", { method: "POST", body: payload });
}

export interface MomentCreate {
  description: string;
  timestamp: string;
}

export function createMoment(payload: MomentCreate): Promise<Moment> {
  return apiFetch<Moment>("/moments/", { method: "POST", body: payload });
}

export type MomentPatch = Partial<Pick<Moment, "description" | "category">>;

export function patchMoment(id: string, patch: MomentPatch): Promise<Moment> {
  return apiFetch<Moment>(`/moments/${id}/`, { method: "PATCH", body: patch });
}

export function patchTimeEntry(id: string, patch: { task_title: string }): Promise<TimeEntry> {
  return apiFetch<TimeEntry>(`/time-entries/${id}/`, { method: "PATCH", body: patch });
}

export function deleteTimeEntry(id: string): Promise<void> {
  return apiFetch<void>(`/time-entries/${id}/`, { method: "DELETE" });
}

export function deleteMoment(id: string): Promise<void> {
  return apiFetch<void>(`/moments/${id}/`, { method: "DELETE" });
}
