import type { Task } from "../../api/types";
import { formatClockTime, formatDuration, toIsoDay } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { useActiveTimerQuery, useStartTimer } from "../timer/useActiveTimer";
import { byPlannedStart, useScheduledTasksQuery } from "./useScheduledTasks";
import styles from "./todaysSchedule.module.css";

/**
 * The day's plan on the page you work from: see what is next and start it
 * without leaving the timer. Building the plan stays on the workspace — this
 * only reads it.
 */
export function TodaysSchedule() {
  const { data: tasks } = useScheduledTasksQuery(toIsoDay(new Date()));
  const { data: timer } = useActiveTimerQuery();

  // A task without a planned slot is not part of the day's plan.
  const scheduled = byPlannedStart(
    (tasks ?? []).filter((task) => !task.archived && task.planned_start),
  );
  // Nothing planned is not worth a card on a working page.
  if (scheduled.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="todays-schedule-heading">
      <h2 id="todays-schedule-heading" className={styles.heading}>
        Today's schedule
      </h2>
      <ul className={styles.list} aria-label="Today's schedule">
        {scheduled.map((task) => (
          <li
            key={task.id}
            className={task.first_started_at ? `${styles.row} ${styles.started}` : styles.row}
          >
            <span className={styles.slot}>{formatClockTime(task.planned_start!)}</span>
            <span className={styles.name}>{task.title}</span>
            <StartButton task={task} timerRunning={Boolean(timer)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartButton({ task, timerRunning }: { task: Task; timerRunning: boolean }) {
  const startTimer = useStartTimer();

  return (
    <button
      className={styles.start}
      type="button"
      aria-label={`Start ${task.title}`}
      // Starting replaces any running timer outright, losing its time without
      // recording an entry. Stop the current one first — the timer is right
      // above this list.
      disabled={timerRunning || !isSettled(task.id)}
      title={timerRunning ? "Stop the running timer first" : undefined}
      onClick={() =>
        startTimer.mutate({
          payload: {
            task_title: task.title,
            task: task.id,
            started_at: new Date().toISOString(),
            elapsed_seconds: 0,
            is_paused: false,
            // The planned length becomes the countdown, as on the workspace.
            mode: task.planned_duration ? "countdown" : "stopwatch",
            target_duration: task.planned_duration ?? null,
          },
        })
      }
    >
      Start
      {task.planned_duration ? (
        <span className={styles.length}>{formatDuration(task.planned_duration)}</span>
      ) : null}
    </button>
  );
}
