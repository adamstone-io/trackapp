import type { DayStats } from "../../api/types";
import { formatDuration, formatWeekdayDayMonth, parseIsoDay } from "../../lib/time";
import { Card } from "./Card";
import styles from "./dashboard.module.css";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** "1h across 2 entries" — what a column's hover says about its day. */
function describeDay(day: DayStats): string {
  if (day.total_seconds === 0) return "nothing tracked";
  const entries = day.entry_count === 1 ? "1 entry" : `${day.entry_count} entries`;
  return `${formatDuration(day.total_seconds)} across ${entries}`;
}

/** A column per day of tracked time, oldest on the left, today on the right. */
export function DailyTrend({ days }: { days: DayStats[] }) {
  const tallest = Math.max(...days.map((day) => day.total_seconds), 1);

  return (
    <Card title={`Last ${days.length} days`}>
      <ul className={styles.trend} aria-label={`Time tracked over the last ${days.length} days`}>
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <li
              key={day.date}
              className={styles.trendColumn}
              title={`${formatWeekdayDayMonth(day.date)} — ${describeDay(day)}`}
            >
              <div className={styles.trendTrack}>
                <div
                  className={isToday ? `${styles.trendFill} ${styles.today}` : styles.trendFill}
                  style={{ height: `${(day.total_seconds / tallest) * 100}%` }}
                />
              </div>
              <span className={styles.trendTick}>
                {WEEKDAY_INITIALS[parseIsoDay(day.date).getDay()]}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
