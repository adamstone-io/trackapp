import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTodayEntries } from "../../api/entries";
import type { TodayEntry } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { TODAY_ENTRIES_KEY, useRenameMoment, useRenameTimeEntry } from "./useTimeEntries";
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

/**
 * Click-to-rename text: a button that swaps to an input; Enter/blur commits,
 * Escape cancels. Rows still waiting on their server id render plain text.
 */
function EditableText({
  value,
  ariaLabel,
  className,
  editable,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  className: string;
  editable: boolean;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) return;
    onCommit(next);
  }

  if (editing) {
    return (
      <input
        className={styles.editInput}
        type="text"
        aria-label={ariaLabel}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  if (!editable) return <span className={className}>{value}</span>;

  return (
    <button
      className={className}
      type="button"
      title="Rename"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </button>
  );
}

/** A just-added optimistic row has no server id yet; let it settle first. */
function isSettled(id: string): boolean {
  return !id.startsWith("optimistic-");
}

function TimeEntryRow({ entry }: { entry: Extract<TodayEntry, { type: "time_entry" }> }) {
  const data = entry.data;
  const renameEntry = useRenameTimeEntry();
  return (
    <>
      <div className={styles.main}>
        <EditableText
          value={data.task_title}
          ariaLabel="Entry title"
          className={styles.title}
          editable={isSettled(entry.id)}
          onCommit={(taskTitle) => renameEntry.mutate({ id: entry.id, taskTitle })}
        />
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
  const renameMoment = useRenameMoment();

  return (
    <>
      <div className={styles.main}>
        <span className={styles.momentMark} aria-hidden="true">
          ◆
        </span>
        <EditableText
          value={data.description}
          ariaLabel="Moment text"
          className={styles.momentText}
          editable={isSettled(entry.id)}
          onCommit={(description) => renameMoment.mutate({ id: entry.id, description })}
        />
      </div>
      <div className={styles.meta}>
        <span>{formatClockTime(data.timestamp)}</span>
      </div>
    </>
  );
}
