const DAY_MS = 24 * 60 * 60 * 1000;

function interactionTier(timestampMs, now) {
  if (timestampMs === null) return 1;
  return now - timestampMs >= DAY_MS ? 0 : 2;
}

/**
 * Sorts items using three-tier prioritization:
 *   0 — interacted >24h ago (due, shown first)
 *   1 — never interacted (shown after all due items)
 *   2 — interacted <24h ago (recently touched, shown last)
 *
 * @param {Array} items
 * @param {string} lastInteractedKey - property name for the last-interaction timestamp (e.g. "lastStudiedAt", "lastPrimedAt")
 * @returns {Array} sorted copy
 */
export function sortByInteractionPriority(items, lastInteractedKey) {
  const now = Date.now();

  return [...items].sort((a, b) => {
    const aTs = a[lastInteractedKey] ? new Date(a[lastInteractedKey]).getTime() : null;
    const bTs = b[lastInteractedKey] ? new Date(b[lastInteractedKey]).getTime() : null;

    const tierDiff = interactionTier(aTs, now) - interactionTier(bTs, now);
    if (tierDiff !== 0) return tierDiff;

    const aLast = aTs ?? Infinity;
    const bLast = bTs ?? Infinity;
    if (aLast !== bLast) return aLast - bLast;

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
    return aCreated - bCreated;
  });
}
