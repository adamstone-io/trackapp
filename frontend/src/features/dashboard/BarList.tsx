import styles from "./dashboard.module.css";

export interface BarRow {
  /** Row label. */
  name: string;
  /** What the bar's length is proportional to. */
  value: number;
  /** The value as the reader should see it ("2h 30m", "12"). */
  display: string;
}

/** A horizontal bar chart: one row per item, bars scaled to the largest. */
export function BarList({ label, rows }: { label: string; rows: BarRow[] }) {
  const longest = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((row) => (
        <li key={row.name} className={styles.bar}>
          <div className={styles.barHead}>
            <span className={styles.barName}>{row.name}</span>
            <span className={styles.barValue}>{row.display}</span>
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(row.value / longest) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
