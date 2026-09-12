import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

interface PageShellProps {
  /** Omit on pages where the active nav link already names the page. */
  title?: string;
  children?: ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className={styles.page}>
      {title && <h1>{title}</h1>}
      {children}
    </main>
  );
}
