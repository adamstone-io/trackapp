// views/entries-view.js
import { byId } from "../ui/ui-core.js";

export const EntriesView = {
  list: () => byId("entries-list"),
  empty: () => byId("entries-empty"),

  /**
   * Render time entries to the DOM.
   */
  render(entries) {
    const list = this.list();
    const empty = this.empty();

    if (entries.length === 0) {
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }

    list.style.display = "block";
    empty.style.display = "none";

    list.innerHTML = entries
      .map((entry) => this.renderEntry(entry))
      .join("");
  },

  /**
   * Render a single entry.
   */
  renderEntry(entry) {
    const duration = this.formatDuration(entry.durationSeconds);
    const timeRange = this.formatTimeRange(entry.startedAt, entry.endedAt);
    const category = entry.category || "Uncategorized";

    return `
      <div class="entry-card">
      <div class="entry-card__header">
        <span class="entry-card__title">${entry.taskTitle || "Untitled Task"}</span>
        <span class="entry-card__duration">${duration}</span>
      </div>
      <div class="entry-card__meta">
        <span class="entry-card__time">${timeRange}</span>
      </div>
      ${entry.notes ? `<p class="entry-card__notes">${entry.notes}</p>` : ""}
    </div>

    `;
  },

  /**
   * Format duration in seconds to readable string.
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },

  /**
   * Format time range.
   */
  formatTimeRange(startedAt, endedAt) {
    const start = new Date(startedAt);
    const end = new Date(endedAt);

    const formatTime = (date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
  },
};
