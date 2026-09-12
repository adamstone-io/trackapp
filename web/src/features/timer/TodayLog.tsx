import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTodayEntries } from "../../api/entries";
import type { TodayEntry } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { TODAY_ENTRIES_KEY, useRenameMoment } from "./useTimeEntries";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.description);
  const renameMoment = useRenameMoment();
  // A just-added moment is still being created server-side; let it settle first.
  const editable = !entry.id.startsWith("optimistic-");

  function commit() {
    setEditing(false);
    const description = draft.trim();
    if (!description || description === data.description) return;
    renameMoment.mutate({ id: entry.id, description });
  }

  return (
    <>
      <div className={styles.main}>
        <span className={styles.momentMark} aria-hidden="true">
          ◆
        </span>
        {editing ? (
          <input
            className={styles.momentInput}
            type="text"
            aria-label="Moment text"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setEditing(false);
            }}
          />
        ) : editable ? (
          <button
            className={styles.momentText}
            type="button"
            title="Rename moment"
            onClick={() => {
              setDraft(data.description);
              setEditing(true);
            }}
          >
            {data.description}
          </button>
        ) : (
          <span className={styles.momentText}>{data.description}</span>
        )}
      </div>
      <div className={styles.meta}>
        <span>{formatClockTime(data.timestamp)}</span>
      </div>
    </>
  );
}
