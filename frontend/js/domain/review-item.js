/**
 * ReviewItem represents a topic or concept that is being reviewed/studied.
 * It tracks when first studied, last review time, and total number of reviews.
 */
export class ReviewItem {
  /**
   * @param {Object} data
   * @param {string} [data.id] - Unique identifier
   * @param {string} data.title - Name of the topic/concept to review
   * @param {string} [data.description] - Additional notes or details
   * @param {string} [data.category] - Category for organizing review items
   * @param {Array<number>} [data.reviewTimestamps] - Array of timestamps (ms) when reviewed
   * @param {number|null} [data.firstStudiedAt] - Timestamp when first studied (ms)
   * @param {boolean} [data.archived] - Whether item is archived
   * @param {string} [data.createdAt] - ISO date string for creation time
   */
  constructor({
    id,
    title,
    description = "",
    category = "",
    reviewTimestamps = [],
    firstStudiedAt = null,
    archived = false,
    createdAt = null,
  }) {
    this.id = id ?? crypto.randomUUID();
    this.title = title.trim();
    this.description = description.trim();
    this.category = category.trim().toLowerCase();
    this.reviewTimestamps = [...reviewTimestamps];
    this.firstStudiedAt = firstStudiedAt;
    this.archived = archived;
    this.createdAt = createdAt ?? new Date().toISOString();
  }

  /**
   * Log a new review session (adds current timestamp).
   */
  logReview() {
    const now = Date.now();
    this.reviewTimestamps.push(now);
    
    // Set first studied date if not already set
    if (this.firstStudiedAt === null) {
      this.firstStudiedAt = now;
    }
  }

  /**
   * Get total number of times this item has been reviewed.
   */
  getTotalCount() {
    return this.reviewTimestamps.length;
  }

  /**
   * Get count of reviews today.
   */
  getTodayCount() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return this.reviewTimestamps.filter((ts) => ts >= todayMs).length;
  }

  /**
   * Get count of reviews this week (week starts on Sunday).
   */
  getThisWeekCount() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();

    return this.reviewTimestamps.filter((ts) => ts >= weekStartMs).length;
  }

  /**
   * Get count of reviews this month.
   */
  getThisMonthCount() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    return this.reviewTimestamps.filter((ts) => ts >= monthStartMs).length;
  }

  /**
   * Get when this item was first studied.
   * @returns {Date|null}
   */
  getFirstStudiedDate() {
    if (this.firstStudiedAt === null) return null;
    return new Date(this.firstStudiedAt);
  }

  /**
   * Get the last time this item was reviewed.
   * @returns {Date|null}
   */
  getLastReviewDate() {
    if (this.reviewTimestamps.length === 0) return null;
    const lastTimestamp = Math.max(...this.reviewTimestamps);
    return new Date(lastTimestamp);
  }

  /**
   * Get a human-readable "time ago" string for first studied date.
   */
  getFirstStudiedTimeAgo() {
    const firstDate = this.getFirstStudiedDate();
    if (!firstDate) return "Never";

    const now = Date.now();
    const diff = now - firstDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return firstDate.toLocaleDateString();
  }

  /**
   * Get a human-readable "time ago" string for last review.
   */
  getLastReviewTimeAgo() {
    const lastDate = this.getLastReviewDate();
    if (!lastDate) return "Never";

    const now = Date.now();
    const diff = now - lastDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return lastDate.toLocaleDateString();
  }

  /**
   * Archive this item (soft delete).
   */
  archive() {
    this.archived = true;
  }

  /**
   * Restore an archived item.
   */
  restore() {
    this.archived = false;
  }

  /**
   * Update item metadata.
   */
  update({ title, description, category }) {
    if (title !== undefined) this.title = title.trim();
    if (description !== undefined) this.description = description.trim();
    if (category !== undefined) this.category = category.trim().toLowerCase();
  }

  /**
   * Serialize for storage/API.
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      category: this.category,
      reviewTimestamps: this.reviewTimestamps,
      firstStudiedAt: this.firstStudiedAt,
      archived: this.archived,
      createdAt: this.createdAt,
    };
  }

  /**
   * Deserialize from storage/API.
   */
  static fromJSON(data) {
    return new ReviewItem(data);
  }
}
