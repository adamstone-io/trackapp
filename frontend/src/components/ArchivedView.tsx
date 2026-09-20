import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RowMenu } from "./RowMenu";
import { isSettled } from "../lib/optimistic";
import styles from "./ArchivedView.module.css";

export interface ArchivedRow {
  id: string;
  name: string;
  /** Leading adornment, where the kind has one — a project's colour dot. */
  badge?: ReactNode;
}

/**
 * A page of retired things, one kind per page, reached from the ⋮ at the top
 * of the page they belong to.
 *
 * They used to sit under the live list on the page itself, which meant
 * scrolling past them to reach nothing. Off the page entirely, they stay
 * somewhere to go looking rather than something in the way.
 */
export function ArchivedView({
  title,
  backTo,
  backLabel,
  rows,
  empty,
  noun,
  deleteNote,
  onRestore,
  onDelete,
  footer,
}: {
  title: string;
  backTo: string;
  backLabel: string;
  rows: ArchivedRow[];
  /** What to say when nothing has been retired yet. */
  empty: string;
  /** Singular, for the row actions' accessible names ("Restore {name}"). */
  noun: string;
  /** What permanent deletion costs, shown while the confirm step is armed. */
  deleteNote: string;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  /** Anything below the list — the study page's scroll sentinel. */
  footer?: ReactNode;
}) {
  return (
    <section>
      <div className={styles.head}>
        <h1 className={styles.heading}>{title}</h1>
        <Link className={styles.back} to={backTo}>
          ← {backLabel}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list} aria-label={title}>
          {rows.map((row) => (
            <li key={row.id} className={styles.item}>
              <div className={styles.main}>
                {row.badge}
                <span className={styles.name}>{row.name}</span>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.restore}
                  type="button"
                  aria-label={`Restore ${row.name}`}
                  disabled={!isSettled(row.id)}
                  onClick={() => onRestore(row.id)}
                >
                  Restore
                </button>
                {/* Permanent deletion is offered only here, on things already
                    retired, and only behind the confirm step. */}
                <RowMenu
                  name={`${noun} ${row.name}`}
                  disabled={!isSettled(row.id)}
                  items={[
                    {
                      label: "Delete permanently",
                      danger: true,
                      confirm: "Confirm delete",
                      confirmNote: deleteNote,
                      onSelect: () => onDelete(row.id),
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}
