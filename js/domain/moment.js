// domain/moment.js

/**
 * Moment represents an instantaneous event or milestone.
 * Unlike TimeEntry (which has duration), a Moment captures a single point in time.
 * Moments can be linked to tasks and marked as milestones.
 */
export class Moment {
  /**
   * @param {Object} data
   * @param {string} [data.id] - Unique identifier
   * @param {string} data.description - What happened at this moment
   * @param {string} [data.category] - Category (default: "General")
   * @param {number} [data.timestampMs] - When this moment occurred (default: now)
   * @param {string} [data.createdAt] - ISO date string for creation time (optional)
   */
  constructor({
    id,
    description,
    category = "General",
    createdAt = null,
    timestampMs = Date.now(),
  }) {
    this.id = id ?? crypto.randomUUID();
    this.description = description.trim();
    this.category = category.trim().toLowerCase();
    this.timestampMs = timestampMs;
    this.createdAt = createdAt ?? new Date().toISOString();
  }

  /**
   * Mark this moment as a milestone.
   */
  markAsMilestone() {
    this.isMilestone = true;
  }

  /**
   * Remove milestone status.
   */
  unmarkAsMilestone() {
    this.isMilestone = false;
  }

  /**
   * Format the timestamp for display.
   * @param {string} [locale] - Locale for formatting (default: browser locale)
   */
  formatTime(locale) {
    return new Date(this.timestampMs).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Format the date for display.
   * @param {string} [locale] - Locale for formatting
   */
  formatDate(locale) {
    return new Date(this.timestampMs).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /**
   * Get a human-readable "time ago" string.
   */
  getTimeAgo() {
    const now = Date.now();
    const diff = now - this.timestampMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return this.formatDate();
  }

  /**
   * Serialize for storage/API.
   */
  toJSON() {
    return {
      id: this.id,
      description: this.description,
      category: this.category,
      timestampMs: this.timestampMs,
      taskId: this.taskId,
      taskTitle: this.taskTitle,
      isMilestone: this.isMilestone,
      createdAt: this.createdAt,
    };
  }

  /**
   * Deserialize from storage/API.
   */
  static fromJSON(data) {
    return new Moment(data);
  }
}
