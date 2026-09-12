import { useQuery } from "@tanstack/react-query";
import { getTodayEntries } from "../../api/entries";
import type { TodayEntry } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { TODAY_ENTRIES_KEY } from "./useTimeEntries";
import styles from "./TodayLog.module.css";

export function TodayLog() {
  const { data: entries } = useQuery({
    queryKey: TODAY_ENTRIES_KEY,
    queryFn: getTodayEntries,
  });

  if (!entries) return null;

  return (
    <section className={styles.section}>
      <h2 id="today-log-heading" className={styles.heading}>
        Today
      </h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing logged yet today.</p>
      ) : (
        <ul className={styles.list} aria-labelledby="today-log-heading">
          {entries.map((entry) => (
            <li key={`${entry.type}-${entry.id}`} className={styles.item}>
              {entry.type === "time_entry" ? <TimeEntryRow entry={entry} /> : <MomentRow entry={entry} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TimeEntryRow({ entry }: { entry: Extract<TodayEntry, { type: "time_entry" }> }) {
  const data = entry.data;
  return (
    <>
      <div className={styles.main}>
        <span className={styles.title}>{data.task_title}</span>
        {data.project_name && <span className={styles.project}>{data.project_name}</span>}
      </div>
      <div className={styles.meta}>
        <span>
          {formatClockTime(data.started_at)}
          {data.ended_at ? `–${formatClockTime(data.ended_at)}` : ""}
        </span>
        <span className={styles.duration}>{formatDuration(data.duration_seconds)}</span>
      </div>
    </>
  );
}

function MomentRow({ entry }: { entry: Extract<TodayEntry, { type: "moment" }> }) {
  const data = entry.data;
  return (
    <>
      <div className={styles.main}>
        <span className={styles.momentMark} aria-hidden="true">
          ◆
        </span>
        <span className={styles.momentText}>{data.description}</span>
      </div>
      <div className={styles.meta}>
        <span>{formatClockTime(data.timestamp)}</span>
      </div>
    </>
  );
}
