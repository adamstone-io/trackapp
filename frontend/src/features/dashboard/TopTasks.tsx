import type { PeriodStats } from "../../api/types";
import { formatDuration } from "../../lib/time";
import { BarList } from "./BarList";
import { Card } from "./Card";
import styles from "./dashboard.module.css";

const TOP_TASKS = 5;

/** The tasks that took the most time in the period. */
export function TopTasks({ stats }: { stats: PeriodStats }) {
  const tasks = stats.by_task.slice(0, TOP_TASKS);
  const total = stats.total_seconds > 0 ? formatDuration(stats.total_seconds) : "nothing tracked";

  return (
    <Card title="Top tasks" action={<span className={styles.total}>{total}</span>}>
      {tasks.length === 0 ? (
        <p className={styles.empty}>No time tracked in this period.</p>
      ) : (
        <BarList
          label="Top tasks"
          rows={tasks.map((task) => ({
            name: task.title,
            value: task.total_seconds,
            display: formatDuration(task.total_seconds),
          }))}
        />
      )}
    </Card>
  );
}
