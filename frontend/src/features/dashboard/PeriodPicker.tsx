import type { StatsPeriod } from "../../api/types";
import styles from "./dashboard.module.css";

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
];

/** Chooses the period the breakdown below it covers. */
export function PeriodPicker({
  period,
  onChange,
}: {
  period: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  return (
    <div className={styles.periods} role="group" aria-label="Period">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={value === period ? `${styles.period} ${styles.periodOn}` : styles.period}
          aria-pressed={value === period}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
