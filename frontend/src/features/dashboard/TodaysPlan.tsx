import type { Task } from "../../api/types";
import { formatClockTime } from "../../lib/time";
import { byPlannedStart } from "../scheduledTasks/useScheduledTasks";
import { Card } from "./Card";
import styles from "./dashboard.module.css";

/** The day's scheduled tasks, earliest first — what is still ahead. */
export function TodaysPlan({ tasks }: { tasks: Task[] }) {
  const scheduled = byPlannedStart(tasks.filter((task) => !task.archived && task.planned_start));

  return (
    <Card title="Today's plan">
      {scheduled.length === 0 ? (
        <p className={styles.empty}>Nothing scheduled today.</p>
      ) : (
        <ul className={styles.plan} aria-label="Today's plan">
          {scheduled.map((task) => (
            <li
              key={task.id}
              className={task.first_started_at ? `${styles.planRow} ${styles.planDone}` : styles.planRow}
            >
              <span className={styles.planTime}>{formatClockTime(task.planned_start!)}</span>
              <span className={styles.planTitle}>{task.title}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
