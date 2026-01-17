// controllers/entries-controller.js
import { EntriesView } from "../views/list-entries-view.js";
import { loadTimeEntries } from "../data/storage.js";

export function createEntriesController() {
  const entries = loadTimeEntries();
  const todayEntries = filterTodayEntries(entries);

  // Initial render
  EntriesView.render(todayEntries);

  /**
   * Filter entries for today.
   */
  function filterTodayEntries(entries) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return entries.filter((entry) => {
      const entryDate = new Date(entry.startedAt);
      return entryDate >= today && entryDate < tomorrow;
    });
  }

  /**
   * Refresh the display (call after new entry is saved).
   */
  function refresh() {
    const entries = loadTimeEntries();
    const todayEntries = filterTodayEntries(entries);
    EntriesView.render(todayEntries);
  }

  return {
    refresh,
    dispose: () => {
      // No listeners to unbind for now
    },
  };
}
