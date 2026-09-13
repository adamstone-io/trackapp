import type { DayStats } from "../../api/types";
import { formatDuration } from "../../lib/time";
import { Card } from "./Card";
import { Column } from "./Column";
import styles from "./dashboard.module.css";

/** How today's tracked time stands against yesterday's. */
export function TimeComparison({ days }: { days: DayStats[] }) {
  const today = days[days.length - 1]?.total_seconds ?? 0;
  const yesterday = days[days.length - 2]?.total_seconds ?? 0;
  const tallest = Math.max(today, yesterday, 1);

  return (
    <Card title="Time tracked">
      <div className={styles.compare}>
        <Column label="Today" value={today} display={show(today)} tallest={tallest} highlight />
        <Column label="Yesterday" value={yesterday} display={show(yesterday)} tallest={tallest} />
      </div>
      <p className={styles.delta}>{describeGap(today - yesterday)}</p>
    </Card>
  );
}

function show(seconds: number): string {
  return seconds > 0 ? formatDuration(seconds) : "—";
}

function describeGap(seconds: number): string {
  if (seconds === 0) return "Level with yesterday";
  const direction = seconds > 0 ? "more" : "less";
  return `${formatDuration(Math.abs(seconds))} ${direction} than yesterday`;
}
