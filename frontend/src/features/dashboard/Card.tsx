import { useId, type ReactNode } from "react";
import styles from "./dashboard.module.css";

/** A titled block of the dashboard. `action` sits opposite the title. */
export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.cardHead}>
        <h2 id={headingId} className={styles.heading}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
