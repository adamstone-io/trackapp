import { useState } from "react";
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
  useRenameTimeEntry,
} from "./useTimeEntries";
import { ProjectSelect } from "../projects/ProjectSelect";
import { useProjectsQuery } from "../projects/useProjects";
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

/** Row text that also opens its editor on click (the ⋮ menu's Edit twin). */
function ClickableText({
  value,
  className,
  editable,
  onClick,
}: {
  value: string;
  className: string;
  editable: boolean;
  onClick: () => void;
}) {
  if (!editable) return <span className={className}>{value}</span>;
  return (
    <button className={className} type="button" title="Rename" onClick={onClick}>
      {value}
    </button>
  );
}

function TimeEntryRow({ entry }: { entry: Extract<TodayEntry, { type: "time_entry" }> }) {
  const data = entry.data;
  const [editing, setEditing] = useState(false);
  const [movingProject, setMovingProject] = useState(false);
  const renameEntry = useRenameTimeEntry();
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
            initial={data.task_title}
            ariaLabel="Entry title"
            onClose={() => setEditing(false)}
            onCommit={(taskTitle) => renameEntry.mutate({ id: entry.id, taskTitle })}
          />
        ) : (
          <ClickableText
            value={data.task_title}
            className={styles.title}
            editable={isSettled(entry.id)}
            onClick={() => setEditing(true)}
          />
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
        items={[
          { label: "Edit", onSelect: () => setEditing(true) },
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
        <span>{formatClockTime(data.timestamp)}</span>
      </div>
      <RowMenu
        name={data.description}
        disabled={!isSettled(entry.id)}
        items={[
          { label: "Edit", onSelect: () => setEditing(true) },
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
