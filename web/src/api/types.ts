/** Shapes returned by the TrackApp API (snake_case, matching the Django serializers). */

export interface TimeEntry {
  id: string;
  task: string | null;
  task_title: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  notes: string;
  breaks: unknown[];
  created_at?: string;
  /** Enrichment added by GET /today-entries/ when the task belongs to a project. */
  project_name?: string;
  project_color?: string;
  project_id?: string;
}

export interface Moment {
  id: string;
  description: string;
  category: string;
  timestamp: string;
  task: string | null;
  task_title: string;
  is_milestone: boolean;
  created_at?: string;
}

export type TodayEntry =
  | { type: "time_entry"; id: string; sort_time: string; data: TimeEntry }
  | { type: "moment"; id: string; sort_time: string; data: Moment };

export interface Task {
  id: string;
  title: string;
  category: string;
  project: string | null;
  notes: string;
  archived: boolean;
}

export type TimerMode = "stopwatch" | "countdown";

export interface ActiveTimer {
  id: number;
  task_title: string;
  task: string | null;
  /** Start of the current running segment (reset on resume). */
  started_at: string;
  /** Seconds accumulated before the current running segment. */
  elapsed_seconds: number;
  is_paused: boolean;
  mode: TimerMode;
  target_duration: number | null;
  created_at: string;
}
