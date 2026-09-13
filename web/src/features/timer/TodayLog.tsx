import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTodayEntries } from "../../api/entries";
import type { TodayEntry } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";
import { TODAY_ENTRIES_KEY, useEditMoment, useRenameTimeEntry } from "./useTimeEntries";
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

/** Text editor opened from a row's ⋮ menu; Enter/blur commits, Escape cancels. */
function EditText({
  initial,
  ariaLabel,
  onClose,
  onCommit,
}: {
  initial: string;
  ariaLabel: string;
  onClose: () => void;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  function commit() {
    onClose();
    const next = draft.trim();
    if (!next || next === initial) return;
    onCommit(next);
  }

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
        if (event.key === "Escape") onClose();
      }}
    />
  );
}

function TimeEntryRow({ entry }: { entry: Extract<TodayEntry, { type: "time_entry" }> }) {
  const data = entry.data;
  const [editing, setEditing] = useState(false);
  const renameEntry = useRenameTimeEntry();
  return (
    <>
      <div className={styles.main}>
        {editing ? (
          <EditText
            initial={data.task_title}
            ariaLabel="Entry title"
            onClose={() => setEditing(false)}
            onCommit={(taskTitle) => renameEntry.mutate({ id: entry.id, taskTitle })}
          />
        ) : (
          <span className={styles.title}>{data.task_title}</span>
        )}
        {data.project_name && <span className={styles.project}>{data.project_name}</span>}
      </div>
      <div className={styles.meta}>
        <span>
          {formatClockTime(data.started_at)}
          {data.ended_at ? `–${formatClockTime(data.ended_at)}` : ""}
        </span>
        <span className={styles.duration}>{formatDuration(data.duration_seconds)}</span>
      </div>
      <RowMenu
        name={data.task_title}
        disabled={!isSettled(entry.id)}
        items={[{ label: "Edit", onSelect: () => setEditing(true) }]}
      />
    </>
  );
}

// Same set the legacy moment modal offered; the backend stores free text.
const MOMENT_CATEGORIES = ["general", "insight", "progress", "milestone", "blocker", "decision"];

/** Click-to-edit category chip: a button that swaps to a select; picking commits. */
function CategoryChip({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const options = MOMENT_CATEGORIES.includes(value) ? MOMENT_CATEGORIES : [value, ...MOMENT_CATEGORIES];
    return (
      <select
        className={styles.categorySelect}
        aria-label="Moment category"
        value={value}
        autoFocus
        onChange={(event) => {
          setEditing(false);
          if (event.target.value !== value) onCommit(event.target.value);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
      >
        {options.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    );
  }

  if (!editable) return <span className={styles.category}>{value}</span>;

  return (
    <button className={styles.category} type="button" title="Change category" onClick={() => setEditing(true)}>
      {value}
    </button>
  );
}

function MomentRow({ entry }: { entry: Extract<TodayEntry, { type: "moment" }> }) {
  const data = entry.data;
  const [editing, setEditing] = useState(false);
  const editMoment = useEditMoment();

  return (
    <>
      <div className={styles.main}>
        <span className={styles.momentMark} aria-hidden="true">
          ◆
        </span>
        {editing ? (
          <EditText
            initial={data.description}
            ariaLabel="Moment text"
            onClose={() => setEditing(false)}
            onCommit={(description) => editMoment.mutate({ id: entry.id, patch: { description } })}
          />
        ) : (
          <span className={styles.momentText}>{data.description}</span>
        )}
      </div>
      <div className={styles.meta}>
        <CategoryChip
          value={data.category}
          editable={isSettled(entry.id)}
          onCommit={(category) => editMoment.mutate({ id: entry.id, patch: { category } })}
        />
        <span>{formatClockTime(data.timestamp)}</span>
      </div>
      <RowMenu
        name={data.description}
        disabled={!isSettled(entry.id)}
        items={[{ label: "Edit", onSelect: () => setEditing(true) }]}
      />
    </>
  );
}
