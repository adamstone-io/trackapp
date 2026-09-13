import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../../api/types";
import { formatClockTime, formatDuration } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";
import { ProjectSelect } from "../projects/ProjectSelect";
import { useProjectsQuery } from "../projects/useProjects";
import { useStartTimer } from "../timer/useActiveTimer";
import {
  useCreateScheduledTask,
  useDeleteScheduledTask,
  useEditScheduledTask,
  useScheduledTasksQuery,
} from "./useScheduledTasks";
import styles from "./scheduledTasks.module.css";
import formStyles from "../projects/forms.module.css";

/** Local "YYYY-MM-DD" — the day the list is showing. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "HH:MM" on the given day, local time, as an ISO timestamp. */
function isoAt(day: string, time: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, date, hours, minutes, 0, 0).toISOString();
}

function toTimeValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduledTaskSection() {
  const [day, setDay] = useState(todayIso);
  const { data: tasks } = useScheduledTasksQuery(day);
  const scheduled = (tasks ?? []).filter((task) => !task.archived);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="scheduled-tasks-heading" className={styles.heading}>
          Scheduled
        </h2>
        <input
          className={styles.dayInput}
          type="date"
          aria-label="Day to schedule"
          value={day}
          onChange={(event) => setDay(event.target.value || todayIso())}
        />
      </div>
      <AddScheduledTaskForm day={day} />
      {scheduled.length === 0 ? (
        <p className={styles.empty}>Nothing scheduled for this day.</p>
      ) : (
        <ul className={styles.list} aria-labelledby="scheduled-tasks-heading">
          {scheduled.map((task) => (
            <li key={task.id} className={styles.item}>
              <ScheduledTaskRow task={task} day={day} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduledTaskRow({ task, day }: { task: Task; day: string }) {
  const [editing, setEditing] = useState(false);
  const editMutation = useEditScheduledTask(day);
  const deleteMutation = useDeleteScheduledTask(day);
  const startTimer = useStartTimer();
  const navigate = useNavigate();
  const { data: projects } = useProjectsQuery();
  const project = projects?.find((candidate) => candidate.id === task.project);

  function start() {
    startTimer.mutate(
      {
        payload: {
          task_title: task.title,
          task: task.id,
          started_at: new Date().toISOString(),
          elapsed_seconds: 0,
          is_paused: false,
          // The planned length becomes the countdown, as in the legacy app.
          mode: task.planned_duration ? "countdown" : "stopwatch",
          target_duration: task.planned_duration ?? null,
        },
      },
      { onSuccess: () => navigate("/timer") },
    );
  }

  if (editing) {
    return (
      <ScheduledTaskForm
        idPrefix={`edit-scheduled-${task.id}`}
        day={day}
        initial={task}
        onSubmit={(draft) => {
          editMutation.mutate({ id: task.id, patch: draft });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <span className={styles.slot}>
        {task.planned_start ? formatClockTime(task.planned_start) : "—"}
        {task.planned_duration ? ` · ${formatDuration(task.planned_duration)}` : ""}
      </span>
      <div className={styles.main}>
        <div className={styles.titleLine}>
          <span className={styles.name}>{task.title}</span>
          {project && <span className={styles.chip}>{project.name}</span>}
          <Punctuality task={task} />
        </div>
        {task.notes && <p className={styles.notes}>{task.notes}</p>}
      </div>
      <div className={styles.actions}>
        <button
          className={styles.startButton}
          type="button"
          aria-label={`Start ${task.title}`}
          disabled={!isSettled(task.id)}
          onClick={start}
        >
          Start
        </button>
        <RowMenu
          name={task.title}
          disabled={!isSettled(task.id)}
          items={[
            { label: "Edit", onSelect: () => setEditing(true) },
            {
              label: "Archive",
              onSelect: () => editMutation.mutate({ id: task.id, patch: { archived: true } }),
            },
            {
              label: "Delete",
              danger: true,
              confirm: "Confirm delete",
              confirmNote: "Removes the task and the time logged against it.",
              onSelect: () => deleteMutation.mutate(task.id),
            },
          ]}
        />
      </div>
    </>
  );
}

/** R64a: plan against reality, once the task has actually been started. */
function Punctuality({ task }: { task: Task }) {
  if (!task.planned_start || !task.first_started_at) return null;
  const minutesLate = Math.round(
    (Date.parse(task.first_started_at) - Date.parse(task.planned_start)) / 60_000,
  );
  if (minutesLate > 0) {
    return <span className={styles.late}>{minutesLate} min late</span>;
  }
  return <span className={styles.onTime}>on time</span>;
}

function AddScheduledTaskForm({ day }: { day: string }) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateScheduledTask(day);

  if (!open) {
    return (
      <button className={formStyles.openButton} type="button" onClick={() => setOpen(true)}>
        Add scheduled task
      </button>
    );
  }

  return (
    <ScheduledTaskForm
      idPrefix="add-scheduled"
      day={day}
      onSubmit={(draft) => {
        createMutation.mutate(draft);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

interface ScheduledTaskDraft {
  title: string;
  project: string | null;
  notes: string;
  planned_start: string;
  planned_duration: number | null;
}

/** Title/slot/project/notes form shared by add (no initial) and edit. */
function ScheduledTaskForm({
  idPrefix,
  day,
  initial,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  day: string;
  initial?: Task;
  onSubmit: (draft: ScheduledTaskDraft) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [start, setStart] = useState(
    initial?.planned_start ? toTimeValue(initial.planned_start) : "",
  );
  const [end, setEnd] = useState(() => {
    if (!initial?.planned_start || !initial.planned_duration) return "";
    return toTimeValue(
      new Date(Date.parse(initial.planned_start) + initial.planned_duration * 1000).toISOString(),
    );
  });
  const [projectId, setProjectId] = useState<string | null>(initial?.project ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !start) return;
    const plannedStart = isoAt(day, start);
    // An end time is optional; without one the task has a start but no length.
    const seconds = end
      ? Math.round((Date.parse(isoAt(day, end)) - Date.parse(plannedStart)) / 1000)
      : 0;
    onSubmit({
      title: trimmed,
      project: projectId,
      notes: notes.trim(),
      planned_start: plannedStart,
      planned_duration: seconds > 0 ? seconds : null,
    });
  }

  return (
    <form className={initial ? formStyles.rowForm : formStyles.form} onSubmit={handleSubmit}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-title`}>
          Task
        </label>
        <input
          id={`${idPrefix}-title`}
          className={formStyles.nameInput}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
      </div>
      <div className={styles.times}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor={`${idPrefix}-start`}>
            Start
          </label>
          <input
            id={`${idPrefix}-start`}
            className={formStyles.input}
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor={`${idPrefix}-end`}>
            End
          </label>
          <input
            id={`${idPrefix}-end`}
            className={formStyles.input}
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-project`}>
          Project
        </label>
        <ProjectSelect
          id={`${idPrefix}-project`}
          className={formStyles.input}
          value={projectId}
          onChange={setProjectId}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-notes`}>
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          className={formStyles.input}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
      </div>
      <div className={formStyles.buttons}>
        <button className={formStyles.saveButton} type="submit">
          Save
        </button>
        <button className={formStyles.cancelButton} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
