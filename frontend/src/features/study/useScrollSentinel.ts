import { useCallback, useRef } from "react";

/** Ask for the next page a little before the foot of the list is reached, so
 * the rows are there by the time the scroll arrives. */
const LOOKAHEAD = "400px";

/**
 * A ref for an element at the foot of a list: when it comes into view, the
 * next page is asked for.
 *
 * A callback ref rather than `useRef` + `useEffect`, because the sentinel is
 * unmounted and remounted as pages load and the list empties and refills — a
 * callback ref sees every one of those changes, where an effect keyed on the
 * element would not.
 */
export function useScrollSentinel(onReach: () => void, enabled: boolean) {
  const observer = useRef<IntersectionObserver | null>(null);
  // Held in a ref so a changed callback never tears down the observer: the
  // handler closes over the latest one instead.
  const latest = useRef(onReach);
  latest.current = onReach;

  return useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node || !enabled) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) latest.current();
        },
        { rootMargin: LOOKAHEAD },
      );
      observer.current.observe(node);
    },
    [enabled],
  );
}
