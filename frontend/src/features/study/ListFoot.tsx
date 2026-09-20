import type { StudyList } from "./useStudyItems";
import { useScrollSentinel } from "./useScrollSentinel";
import styles from "./study.module.css";

/**
 * The end of a paged list. It offers nothing to press: coming into view is
 * itself the request for the next page.
 */
export function ListFoot({ list, label }: { list: StudyList; label: string }) {
  const sentinel = useScrollSentinel(
    list.fetchNextPage,
    list.hasNextPage && !list.isFetchingNextPage,
  );

  if (!list.hasNextPage) return null;
  return (
    <div ref={sentinel} className={styles.loadMore}>
      {list.isFetchingNextPage && (
        <p className={styles.loadingMore} role="status">{`Loading more ${label}…`}</p>
      )}
    </div>
  );
}

/**
 * Retired items, folded away. They are somewhere to go looking when you want
 * one back, not something to scroll past on the way down the active list —
 * which is what they became once the active list stopped loading whole.
 */
