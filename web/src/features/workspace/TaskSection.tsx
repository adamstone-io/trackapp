import { useState, type FormEvent } from "react";
import type { Project, Task } from "../../api/types";
import type { TaskCreate } from "../../api/tasks";
import { formatDuration } from "../../lib/time";
import { useCreateTask, useDeleteTask, useEditTask, useProjectsQuery, useTasksQuery } from "./useWorkspace";
import { ColorDot } from "./ProjectSection";
import { isSettled } from "../../lib/optimistic";
import styles from "./workspace.module.css";
import formStyles from "./forms.module.css";

export function TaskSection() {
  const { data: tasks } = useTasksQuery();
  const { data: projects } = useProjectsQuery();

  if (!tasks || !projects) return null;
  const active = tasks.filter((task) => !task.archived);
  const archived = tasks.filter((task) => task.archived);

  return (
    <>
      <section className={styles.section}>
        <h2 id="tasks-heading" className={styles.heading}>
          Tasks
        </h2>
        {active.length === 0 ? (
          <p className={styles.empty}>Add your first task.</p>
        ) : (
          <ul className={styles.list} aria-labelledby="tasks-heading">
            {active.map((task) => (
              <li key={task.id} className={styles.item}>
                <TaskRow task={task} projects={projects} />
              </li>
            ))}
          </ul>
        )}
        <AddTaskForm projects={projects} />
      </section>
      {archived.length > 0 && <ArchivedTasks tasks={archived} />}
    </>
  );
}

function ArchivedTasks({ tasks }: { tasks: Task[] }) {
  const editMutation = useEditTask();
  return (
    <section className={styles.section}>
      <h2 id="archived-tasks-heading" className={styles.heading}>
        Archived tasks
      </h2>
      <ul className={styles.list} aria-labelledby="archived-tasks-heading">
        {tasks.map((task) => (
          <li key={task.id} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.archivedName}>{task.title}</span>
            </div>
            <button
              className={styles.moreAction}
              type="button"
              aria-label={`Restore ${task.title}`}
              disabled={!isSettled(task.id)}
              onClick={() => editMutation.mutate({ id: task.id, patch: { archived: false } })}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "2 logged entries are deleted with it." — the task-delete cascade warning. */
function deleteWarning(entryCount: number): string {
  if (entryCount === 0) return "No time is logged on this task.";
  if (entryCount === 1) return "1 logged entry is deleted with it.";
  return `${entryCount} logged entries are deleted with it.`;
}

function TaskRow({ task, projects }: { task: Task; projects: Project[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editMutation = useEditTask();
  const deleteMutation = useDeleteTask();
  const project = projects.find((candidate) => candidate.id === task.project);

  if (editing) {
    return (
      <TaskForm
        idPrefix={`edit-task-${task.id}`}
        initial={task}
        projects={projects}
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
      <div className={styles.main}>
        <span className={styles.name}>{task.title}</span>
        {task.category && task.category !== "other" && (
          <span className={styles.chip}>{task.category}</span>
        )}
        {project && (
          <span className={styles.chip}>
            <ColorDot color={project.color} />
            {project.name}
          </span>
        )}
      </div>
      <span className={styles.time}>{formatDuration(task.total_seconds)}</span>
      <div className={styles.actions}>
        <button
          className={styles.moreButton}
          type="button"
          aria-label={`More ${task.title}`}
          aria-expanded={moreOpen}
          disabled={!isSettled(task.id)}
          onClick={() => {
            setMoreOpen((open) => !open);
            setConfirmingDelete(false);
          }}
        >
          ⋯
        </button>
      </div>
      {moreOpen &&
        (confirmingDelete ? (
          <div className={styles.moreRow}>
            <span className={styles.confirmNote}>{deleteWarning(task.entry_count)}</span>
            <button
              className={styles.dangerAction}
              type="button"
              onClick={() => deleteMutation.mutate(task.id)}
            >
              Confirm delete
            </button>
            <button
              className={styles.moreAction}
              type="button"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className={styles.moreRow}>
            <button className={styles.moreAction} type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className={styles.moreAction}
              type="button"
              onClick={() => editMutation.mutate({ id: task.id, patch: { archived: true } })}
            >
              Archive
            </button>
            <button
              className={styles.dangerAction}
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          </div>
        ))}
    </>
  );
}

function AddTaskForm({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateTask();

  if (!open) {
    return (
      <button className={formStyles.openButton} type="button" onClick={() => setOpen(true)}>
        Add task
      </button>
    );
  }

  return (
    <TaskForm
      idPrefix="add-task"
      projects={projects}
      onSubmit={(draft) => {
        createMutation.mutate(draft);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

/** Title/category/project form shared by add (no initial) and edit. */
function TaskForm({
  idPrefix,
  initial,
  projects,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial?: Task;
  projects: Project[];
  onSubmit: (draft: Required<TaskCreate>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(
    initial && initial.category !== "other" ? initial.category : "",
  );
  const [projectId, setProjectId] = useState(initial?.project ?? "");
  const selectable = projects.filter(
    (project) => !project.archived || project.id === initial?.project,
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      // Same normalization as the legacy app; "other" is the backend default.
      category: category.trim().toLowerCase() || "other",
      project: projectId || null,
    });
  }

  return (
    <form className={initial ? formStyles.rowForm : formStyles.form} onSubmit={handleSubmit}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-title`}>
          Title
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
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-category`}>
          Category
        </label>
        <input
          id={`${idPrefix}-category`}
          className={formStyles.input}
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Optional"
          autoComplete="off"
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-project`}>
          Project
        </label>
        <select
          id={`${idPrefix}-project`}
          className={formStyles.select}
          value={projectId ?? ""}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">No project</option>
          {selectable.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <button className={formStyles.saveButton} type="submit">
        Save
      </button>
      <button className={formStyles.cancelButton} type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
