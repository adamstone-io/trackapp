/** "1h 30m", "20m", "45s" — compact human duration for log entries. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** "00:14:09" — zero-padded HH:MM:SS readout for the live timer display. */
export function formatTimerReadout(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Sep 2026" — local calendar date for an ISO timestamp. */
export function formatDayMonthYear(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "10:00" — local wall-clock time for an ISO timestamp. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Whole calendar days from an ISO timestamp to now, in local time.
 * Calendar days, not 24h chunks: something logged last night was "yesterday"
 * this morning. Rounding absorbs the DST hour. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  const thenMidnight = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowMidnight.getTime() - thenMidnight.getTime()) / 86_400_000);
}

/** "never", "today", "yesterday", "20 days ago" — how long since something happened. */
export function formatDaysAgo(iso: string | null): string {
  if (!iso) return "never";
  const days = daysSince(iso);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
