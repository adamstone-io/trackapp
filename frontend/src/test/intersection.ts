/**
 * jsdom ships no IntersectionObserver, and the study list's scroll sentinel
 * needs one. This stands in for it and records what is being watched, so a
 * test can say "the foot of the list came into view" without a real viewport.
 */
type Watcher = { callback: IntersectionObserverCallback; targets: Set<Element> };

const watchers = new Set<Watcher>();

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private watcher: Watcher;

  constructor(callback: IntersectionObserverCallback) {
    this.watcher = { callback, targets: new Set() };
    watchers.add(this.watcher);
  }

  observe(target: Element) {
    this.watcher.targets.add(target);
  }

  unobserve(target: Element) {
    this.watcher.targets.delete(target);
  }

  disconnect() {
    watchers.delete(this.watcher);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

export function installIntersectionObserver() {
  window.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
  watchers.clear();
}

/** Report every watched element as visible — what scrolling to the foot of
 * the list does in a browser. */
export function scrollToListFoot() {
  for (const watcher of watchers) {
    const entries = [...watcher.targets].map(
      (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) watcher.callback(entries, {} as IntersectionObserver);
  }
}
