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
  /** Annotations from the backend — total tracked time and entry count. */
  total_seconds: number;
  entry_count: number;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  /** Annotation: total tracked time across all the project's tasks. */
  total_seconds: number;
  created_at?: string;
}

export interface Habit {
  id: string;
  name: string;
  daily_target: number;
  weekly_target: number;
  monthly_target: number;
  /** Effective counts: the backend zeroes them past a day/week/month boundary. */
  daily_count: number;
  weekly_count: number;
  monthly_count: number;
  is_active: boolean;
  /** Consecutive days the daily target was met; 0 while broken by a gap. */
  streak_count: number;
  last_completed_date: string | null;
  last_logged_at: string | null;
  created_at?: string;
}

export interface StudyItem {
  id: string;
  /** The item's title/front text (legacy field name). */
  prompt: string;
  notes: string;
  category: string;
  image_url: string | null;
  note_image_url: string | null;
  prime_count: number;
  study_count: number;
  first_primed_at: string | null;
  last_primed_at: string | null;
  first_studied_at: string | null;
  last_studied_at: string | null;
  /** Legacy review-mode interactions; read only for recency ordering. */
  last_reviewed_at: string | null;
  is_archived: boolean;
  created_at?: string;
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
