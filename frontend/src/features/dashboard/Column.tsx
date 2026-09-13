import styles from "./dashboard.module.css";

/**
 * One vertical bar with its value above and its name below. Columns in a
 * group share a `tallest`, so their heights are comparable — which means a
 * group must hold one kind of thing: durations with durations, counts with
 * counts.
 */
export function Column({
  label,
  value,
  display,
  tallest,
  highlight = false,
}: {
  label: string;
  /** What the bar's height is proportional to. */
  value: number;
  /** The value as the reader should see it ("3h 12m", "40"). */
  display: string;
  tallest: number;
  highlight?: boolean;
}) {
  return (
    <div className={styles.compareColumn}>
      <span className={styles.compareValue}>{display}</span>
      <div className={styles.compareTrack}>
        <div
          className={highlight ? `${styles.compareFill} ${styles.today}` : styles.compareFill}
          style={{ height: `${(value / tallest) * 100}%` }}
        />
      </div>
      <span className={styles.compareLabel}>{label}</span>
    </div>
  );
}
