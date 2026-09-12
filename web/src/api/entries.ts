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
