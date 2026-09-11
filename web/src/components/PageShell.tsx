import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

interface PageShellProps {
  title: string;
  children?: ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className={styles.page}>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
