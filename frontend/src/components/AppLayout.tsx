import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import { useTimerSync } from "../features/timer/useActiveTimer";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  // R9c: keep this tab honest about a timer started or stopped elsewhere.
  useTimerSync();

  return (
    <>
      <Nav />
      <div className={styles.content}>
        <Outlet />
      </div>
    </>
  );
}
