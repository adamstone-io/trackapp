import { NavLink } from "react-router-dom";
import { formatTimerReadout } from "../../lib/time";
import { useActiveTimerQuery, useElapsedSeconds } from "./useActiveTimer";
import styles from "./TimerBar.module.css";

/** Compact live readout shown in the nav on every page while a timer runs. */
export function TimerBar() {
  const { data: timer } = useActiveTimerQuery();
  const elapsed = useElapsedSeconds(timer);

  if (!timer) return null;

  const remaining =
    timer.mode === "countdown" && timer.target_duration
      ? Math.max(0, timer.target_duration - elapsed)
      : null;

  return (
    <NavLink to="/timer" className={styles.bar} aria-label="Active timer">
      <span className={styles.readout}>{formatTimerReadout(remaining ?? elapsed)}</span>
      <span className={styles.title}>{timer.task_title}</span>
    </NavLink>
  );
}
