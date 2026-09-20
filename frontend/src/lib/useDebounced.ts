import { useEffect, useState } from "react";

/**
 * The value, but held back until it stops changing.
 *
 * The study page's category filter is a server query now, and a request per
 * keystroke would be four requests to spell "kanj" and three wasted.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
