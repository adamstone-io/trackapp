import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  return (
    <>
      <Nav />
      <div className={styles.content}>
        <Outlet />
      </div>
    </>
  );
}
