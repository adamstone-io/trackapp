import { NavLink, useLocation } from "react-router-dom";
import { formatTimerReadout } from "../../lib/time";
import { useActiveTimerQuery, useElapsedSeconds } from "./useActiveTimer";
import styles from "./TimerBar.module.css";

/**
 * Compact live readout shown in the nav while a timer runs — except on the
 * timer page itself, where the full readout already shows.
 */
export function TimerBar() {
  const { data: timer } = useActiveTimerQuery();
  const elapsed = useElapsedSeconds(timer);
  const { pathname } = useLocation();

  if (!timer || pathname === "/timer") return null;

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
