import { NavLink } from "react-router-dom";
import { TimerBar } from "../features/timer/TimerBar";
import styles from "./Nav.module.css";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/timer", label: "Timer" },
  { to: "/projects", label: "Projects" },
  { to: "/study", label: "Study" },
  { to: "/habits", label: "Habits" },
  { to: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={styles.inner}>
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {label}
          </NavLink>
        ))}
        <TimerBar />
      </div>
    </nav>
  );
}
