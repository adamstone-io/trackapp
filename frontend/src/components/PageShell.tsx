import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

/** Page container. Pages have no h1 — the highlighted nav link names them. */
export function PageShell({ children }: { children?: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}
