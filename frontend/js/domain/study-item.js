/**
 * StudyItem represents a topic or concept that is being actively studied.
 * Study items are typically created by converting prime items.
 * They track study sessions, notes, and can later be converted to review items.
 */
export class StudyItem {
  /**
   * @param {Object} data
   * @param {string} [data.id] - Unique identifier
   * @param {string} data.title - Name of the topic/concept to study
   * @param {string} [data.description] - Additional details
   * @param {string} [data.category] - Category for organizing study items
   * @param {string} [data.notes] - Study notes (collapsible)
   * @param {Array<number>} [data.studyTimestamps] - Array of timestamps (ms) when studied
   * @param {number|null} [data.firstStudiedAt] - Timestamp when first studied (ms)
   * @param {boolean} [data.archived] - Whether item is archived
   * @param {string} [data.createdAt] - ISO date string for creation time
   * @param {string|null} [data.sourcePrimeItemId] - ID of the source prime item
   */
  constructor({
    id,
    title,
    description = "",
    category = "",
    notes = "",
    studyTimestamps = [],
    firstStudiedAt = null,
    archived = false,
    createdAt = null,
    sourcePrimeItemId = null,
  }) {
    this.id = id ?? crypto.randomUUID();
    this.title = title.trim();
    this.description = description.trim();
    this.category = category.trim().toLowerCase();
    this.notes = notes;
    this.studyTimestamps = [...studyTimestamps];
    this.firstStudiedAt = firstStudiedAt;
    this.archived = archived;
    this.createdAt = createdAt ?? new Date().toISOString();
    this.sourcePrimeItemId = sourcePrimeItemId;
  }

  /**
   * Log a new study session (adds current timestamp).
   */
  logStudy() {
    const now = Date.now();
    this.studyTimestamps.push(now);

    // Set first studied date if not already set
    if (this.firstStudiedAt === null) {
      this.firstStudiedAt = now;
    }
  }

  /**
   * Get total number of times this item has been studied.
   */
  getTotalCount() {
    return this.studyTimestamps.length;
  }

  /**
   * Get count of study sessions today.
   */
  getTodayCount() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return this.studyTimestamps.filter((ts) => ts >= todayMs).length;
  }

  /**
   * Get count of study sessions this week (week starts on Sunday).
   */
  getThisWeekCount() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();

    return this.studyTimestamps.filter((ts) => ts >= weekStartMs).length;
  }

  /**
   * Get count of study sessions this month.
   */
  getThisMonthCount() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    return this.studyTimestamps.filter((ts) => ts >= monthStartMs).length;
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
   * Get the last time this item was studied.
   * @returns {Date|null}
   */
  getLastStudyDate() {
    if (this.studyTimestamps.length === 0) return null;
    const lastTimestamp = Math.max(...this.studyTimestamps);
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
   * Get a human-readable "time ago" string for last study session.
   */
  getLastStudyTimeAgo() {
    const lastDate = this.getLastStudyDate();
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
  update({ title, description, category, notes }) {
    if (title !== undefined) this.title = title.trim();
    if (description !== undefined) this.description = description.trim();
    if (category !== undefined) this.category = category.trim().toLowerCase();
    if (notes !== undefined) this.notes = notes;
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
      notes: this.notes,
      studyTimestamps: this.studyTimestamps,
      firstStudiedAt: this.firstStudiedAt,
      archived: this.archived,
      createdAt: this.createdAt,
      sourcePrimeItemId: this.sourcePrimeItemId,
    };
  }

  /**
   * Deserialize from storage/API.
   */
  static fromJSON(data) {
    return new StudyItem(data);
  }
}
