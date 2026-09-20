import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import { useTimerSync } from "../features/timer/useActiveTimer";
import { useCountdownExpiry } from "../features/timer/useCountdownExpiry";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  // R9c: keep this tab honest about a timer started or stopped elsewhere.
  useTimerSync();
  // R2b: a countdown ends its session from whichever page happens to be open.
  useCountdownExpiry();

  return (
    <>
      <Nav />
      <div className={styles.content}>
        <Outlet />
      </div>
    </>
  );
}
