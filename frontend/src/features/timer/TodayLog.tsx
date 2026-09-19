import { useState } from "react";
import { useToast } from "../../components/toast/ToastProvider";
import { useQuery } from "@tanstack/react-query";
import { getTodayEntries } from "../../api/entries";
import type { TodayEntry } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";
import {
  TODAY_ENTRIES_KEY,
  useDeleteMoment,
  useDeleteTimeEntry,
  useEditMoment,
  useMoveEntryToProject,
  useEditTimeEntry,
} from "./useTimeEntries";
import { ProjectSelect } from "../projects/ProjectSelect";
import { useProjectsQuery } from "../projects/useProjects";
import styles from "./TodayLog.module.css";
import { capitalizeFirst } from "../../lib/text";

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

/** "HH:MM" from an ISO timestamp, local. */
function toTimeValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "HH:MM" applied to the day an existing timestamp already falls on. */
function withTime(iso: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(iso);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/** Start/end editor for a logged entry. Duration is recomputed from the times
 * the user sets — the backend stores it rather than deriving it. */
function EditTimes({
  startedAt,
  endedAt,
  onClose,
  onCommit,
}: {
  startedAt: string;
  endedAt: string | null;
  onClose: () => void;
  onCommit: (patch: { started_at: string; ended_at: string; duration_seconds: number }) => void;
}) {
  const [start, setStart] = useState(toTimeValue(startedAt));
  const [end, setEnd] = useState(endedAt ? toTimeValue(endedAt) : "");
  const { showToast } = useToast();

  function commit() {
    onClose();
    if (!start || !end) return;
    const nextStart = withTime(startedAt, start);
    const nextEnd = withTime(endedAt ?? startedAt, end);
    const seconds = Math.round((Date.parse(nextEnd) - Date.parse(nextStart)) / 1000);
    if (seconds <= 0) {
      showToast("End time must be after start time.");
      return;
    }
    if (nextStart === startedAt && nextEnd === endedAt) return;
    onCommit({ started_at: nextStart, ended_at: nextEnd, duration_seconds: seconds });
  }

  return (
    <span className={styles.timeEditor} onBlur={(event) => {
      // Leaving the pair entirely commits; moving between the two does not.
      if (!event.currentTarget.contains(event.relatedTarget as Node)) commit();
    }}>
      <input
        className={styles.timeInput}
        type="time"
        aria-label="Start time"
        value={start}
        autoFocus
        onChange={(event) => setStart(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") onClose();
        }}
      />
      <input
        className={styles.timeInput}
        type="time"
        aria-label="End time"
        value={end}
        onChange={(event) => setEnd(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") onClose();
        }}
      />
    </span>
  );
}

/** Row text that also opens its editor on click (the ⋮ menu's Edit twin). */
function ClickableText({
  value,
  className,
  editable,
  onClick,
  title = "Rename",
}: {
  value: string;
  className: string;
  editable: boolean;
  onClick: () => void;
  title?: string;
}) {
  if (!editable) return <span className={className}>{value}</span>;
  return (
    <button className={className} type="button" title={title} onClick={onClick}>
      {value}
    </button>
  );
}

function TimeEntryRow({ entry }: { entry: Extract<TodayEntry, { type: "time_entry" }> }) {
  const data = entry.data;
  const [editing, setEditing] = useState(false);
  const [editingTimes, setEditingTimes] = useState(false);
  const [movingProject, setMovingProject] = useState(false);
  const editEntry = useEditTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const moveEntry = useMoveEntryToProject();
  const { data: projects } = useProjectsQuery();

  function moveToProject(projectId: string | null) {
    setMovingProject(false);
    if ((data.project_id ?? null) === projectId) return;
    moveEntry.mutate({
      id: entry.id,
      taskTitle: data.task_title,
      projectId,
      project: projects?.find((project) => project.id === projectId) ?? null,
    });
  }

  return (
    <>
      <div className={styles.main}>
        {editing ? (
          <EditText
            initial={capitalizeFirst(data.task_title)}
            ariaLabel="Entry title"
            onClose={() => setEditing(false)}
            onCommit={(taskTitle) =>
              editEntry.mutate({ id: entry.id, patch: { task_title: taskTitle } })
            }
          />
        ) : (
          <ClickableText
            value={capitalizeFirst(data.task_title)}
            className={styles.title}
            editable={isSettled(entry.id)}
            onClick={() => setEditing(true)}
          />
        )}
        {data.project_name && <span className={styles.project}>{data.project_name}</span>}
      </div>
      <div className={styles.meta}>
        {editingTimes ? (
          <EditTimes
            startedAt={data.started_at}
            endedAt={data.ended_at}
            onClose={() => setEditingTimes(false)}
            onCommit={(patch) => editEntry.mutate({ id: entry.id, patch })}
          />
        ) : (
          <ClickableText
            value={`${formatClockTime(data.started_at)}${
              data.ended_at ? `–${formatClockTime(data.ended_at)}` : ""
            }`}
            className={styles.times}
            title="Edit times"
            editable={isSettled(entry.id)}
            onClick={() => setEditingTimes(true)}
          />
        )}
        <span className={styles.duration}>{formatDuration(data.duration_seconds)}</span>
      </div>
      <RowMenu
        name={data.task_title}
        disabled={!isSettled(entry.id)}
        items={[
          { label: "Edit", onSelect: () => setEditing(true) },
          { label: "Times", onSelect: () => setEditingTimes(true) },
          { label: "Project", onSelect: () => setMovingProject(true) },
          // One press, no confirm step — the owner's call for the day log.
          { label: "Delete", danger: true, onSelect: () => deleteEntry.mutate(entry.id) },
        ]}
      />
      {movingProject && (
        <div className={styles.moveProject}>
          <ProjectSelect
            ariaLabel={`Project for ${data.task_title}`}
            className={styles.projectSelect}
            value={data.project_id ?? null}
            onChange={moveToProject}
            autoFocus
          />
          <button
            className={styles.cancelMove}
            type="button"
            onClick={() => setMovingProject(false)}
          >
            Cancel
          </button>
        </div>
      )}
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
  const [editingTime, setEditingTime] = useState(false);
  const editMoment = useEditMoment();
  const deleteMoment = useDeleteMoment();

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
          <ClickableText
            value={data.description}
            className={styles.momentText}
            editable={isSettled(entry.id)}
            onClick={() => setEditing(true)}
          />
        )}
      </div>
      <div className={styles.meta}>
        <CategoryChip
          value={data.category}
          editable={isSettled(entry.id)}
          onCommit={(category) => editMoment.mutate({ id: entry.id, patch: { category } })}
        />
        {editingTime ? (
          <input
            className={styles.timeInput}
            type="time"
            aria-label="Moment time"
            defaultValue={toTimeValue(data.timestamp)}
            autoFocus
            onBlur={(event) => {
              setEditingTime(false);
              const next = event.target.value;
              if (!next || next === toTimeValue(data.timestamp)) return;
              editMoment.mutate({ id: entry.id, patch: { timestamp: withTime(data.timestamp, next) } });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setEditingTime(false);
            }}
          />
        ) : (
          <ClickableText
            value={formatClockTime(data.timestamp)}
            className={styles.times}
            title="Edit time"
            editable={isSettled(entry.id)}
            onClick={() => setEditingTime(true)}
          />
        )}
      </div>
      <RowMenu
        name={data.description}
        disabled={!isSettled(entry.id)}
        items={[
          { label: "Edit", onSelect: () => setEditing(true) },
          { label: "Time", onSelect: () => setEditingTime(true) },
          {
            label: "Delete",
            danger: true,
            confirm: "Confirm delete",
            onSelect: () => deleteMoment.mutate(entry.id),
          },
        ]}
      />
    </>
  );
}
