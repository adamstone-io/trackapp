/**
 * PrimeItem represents a topic or concept to prime before studying.
 * Priming involves opening loops and asking questions about material
 * before actually studying it, which enhances learning effectiveness.
 */
export class PrimeItem {
  /**
   * @param {Object} data
   * @param {string} [data.id] - Unique identifier
   * @param {string} data.title - Name of the topic/concept to prime
   * @param {string} [data.description] - Additional notes or questions
   * @param {string} [data.category] - Category for organizing prime items
   * @param {Array<number>} [data.primeTimestamps] - Array of timestamp (ms) when primed
   * @param {boolean} [data.archived] - Whether item is archived
   * @param {string} [data.createdAt] - ISO date string for creation time
   */
  constructor({
    id,
    title,
    description = "",
    category = "",
    primeTimestamps = [],
    archived = false,
    createdAt = null,
  }) {
    this.id = id ?? crypto.randomUUID();
    this.title = title.trim();
    this.description = description.trim();
    this.category = category.trim();
    this.primeTimestamps = [...primeTimestamps];
    this.archived = archived;
    this.createdAt = createdAt ?? new Date().toISOString();
  }

  /**
   * Log a new priming session (adds current timestamp).
   */
  logPrime() {
    this.primeTimestamps.push(Date.now());
  }

  /**
   * Get total number of times this item has been primed.
   */
  getTotalCount() {
    return this.primeTimestamps.length;
  }

  /**
   * Get count of primes today.
   */
  getTodayCount() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= todayMs).length;
  }

  /**
   * Get count of primes this week (week starts on Sunday).
   */
  getThisWeekCount() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= weekStartMs).length;
  }

  /**
   * Get count of primes this month.
   */
  getThisMonthCount() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= monthStartMs).length;
  }

  /**
   * Get the first time this item was primed.
   * @returns {Date|null}
   */
  getFirstPrimeDate() {
    if (this.primeTimestamps.length === 0) return null;
    const firstTimestamp = Math.min(...this.primeTimestamps);
    return new Date(firstTimestamp);
  }

  /**
   * Get the last time this item was primed.
   * @returns {Date|null}
   */
  getLastPrimeDate() {
    if (this.primeTimestamps.length === 0) return null;
    const lastTimestamp = Math.max(...this.primeTimestamps);
    return new Date(lastTimestamp);
  }

  /**
   * Get a human-readable "time ago" string for first prime.
   */
  getFirstPrimeTimeAgo() {
    const firstDate = this.getFirstPrimeDate();
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
   * Get a human-readable "time ago" string for last prime.
   */
  getLastPrimeTimeAgo() {
    const lastDate = this.getLastPrimeDate();
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
    if (category !== undefined) this.category = category.trim();
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
      primeTimestamps: this.primeTimestamps,
      archived: this.archived,
      createdAt: this.createdAt,
    };
  }

  /**
   * Deserialize from storage/API.
   */
  static fromJSON(data) {
    return new PrimeItem(data);
  }
}
