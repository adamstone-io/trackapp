import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayEntry } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";
import { TODAY_ENTRIES_KEY, useAddManualEntry } from "./useTimeEntries";
import { ProjectSelect } from "../workspace/ProjectSelect";
import styles from "./ManualEntryForm.module.css";

function toTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "HH:MM" on today's date, in local time. */
function todayAt(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function ManualEntryForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const addEntry = useAddManualEntry();
  const { showToast } = useToast();

  function handleOpen() {
    const entries = queryClient.getQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY);
    const lastEntry = entries?.find(
      (entry): entry is Extract<TodayEntry, { type: "time_entry" }> => entry.type === "time_entry",
    );
    setStart(lastEntry?.data.ended_at ? toTimeValue(new Date(lastEntry.data.ended_at)) : "");
    setEnd(toTimeValue(new Date()));
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setTitle("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!start || !end) return;
    const startedAt = todayAt(start);
    const endedAt = todayAt(end);
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    if (durationSeconds <= 0) {
      showToast("End time must be after start time.");
      return;
    }
    addEntry.mutate({
      taskTitle: title.trim() || "Untitled",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds,
      projectId,
    });
    handleClose();
  }

  if (!open) {
    return (
      <button className={styles.openButton} type="button" onClick={handleOpen}>
        Add entry
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="manual-task-title">
          Task
        </label>
        <input
          id="manual-task-title"
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="manual-project">
          Project
        </label>
        <ProjectSelect
          id="manual-project"
          className={styles.input}
          value={projectId}
          onChange={setProjectId}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="manual-start">
          Start
        </label>
        <input
          id="manual-start"
          className={styles.timeInput}
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="manual-end">
          End
        </label>
        <input
          id="manual-end"
          className={styles.timeInput}
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          required
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.saveButton} type="submit">
          Save
        </button>
        <button className={styles.cancelButton} type="button" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
