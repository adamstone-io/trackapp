import { useInfiniteQuery } from "@tanstack/react-query";
import { listProjectEntries } from "../../api/entries";
import type { Project } from "../../api/types";
import { Modal } from "../../components/Modal";
import { formatClockTime, formatDayMonthYear, formatDuration } from "../../lib/time";
import styles from "./ProjectEntriesModal.module.css";
import { capitalizeFirst } from "../../lib/text";

/** Every time entry logged against one project — what makes its total up. */
export function ProjectEntriesModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["project-entries", project.id],
      queryFn: ({ pageParam }) => listProjectEntries(project.id, pageParam),
      initialPageParam: 1,
      // DRF hands back a `next` URL; the page number is all we need from it.
      getNextPageParam: (lastPage, pages) => (lastPage.next ? pages.length + 1 : undefined),
    });

  const entries = data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <Modal title={`${project.name} — time entries`} onClose={onClose}>
      {isPending ? (
        <p className={styles.note}>Loading…</p>
      ) : isError ? (
        <p className={styles.note}>Could not load this project's entries.</p>
      ) : entries.length === 0 ? (
        <p className={styles.note}>No time logged against this project yet.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <span className={styles.title}>{capitalizeFirst(entry.task_title)}</span>
                <span className={styles.when}>
                  {formatDayMonthYear(entry.started_at)} · {formatClockTime(entry.started_at)}
                  {entry.ended_at ? `–${formatClockTime(entry.ended_at)}` : ""}
                </span>
                <span className={styles.duration}>{formatDuration(entry.duration_seconds)}</span>
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              className={styles.more}
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
