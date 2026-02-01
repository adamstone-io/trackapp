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
   * @param {number|null} [data.totalCount] - Total primes count (optional)
   * @param {number|null} [data.todayCount] - Primes today (optional)
   * @param {number|null} [data.thisWeekCount] - Primes this week (optional)
   * @param {number|null} [data.thisMonthCount] - Primes this month (optional)
   * @param {string|null} [data.firstPrimedAt] - ISO string of first prime (optional)
   * @param {string|null} [data.lastPrimedAt] - ISO string of last prime (optional)
   * @param {boolean} [data.archived] - Whether item is archived
   * @param {string} [data.createdAt] - ISO date string for creation time
   */
  constructor({
    id,
    title,
    description = "",
    category = "",
    primeTimestamps = [],
    totalCount = null,
    todayCount = null,
    thisWeekCount = null,
    thisMonthCount = null,
    firstPrimedAt = null,
    lastPrimedAt = null,
    archived = false,
    createdAt = null,
  }) {
    this.id = id ?? crypto.randomUUID();
    this.title = title.trim();
    this.description = description.trim();
    this.category = category.trim().toLowerCase();
    this.primeTimestamps = [...primeTimestamps];
    this.totalCount = totalCount;
    this.todayCount = todayCount;
    this.thisWeekCount = thisWeekCount;
    this.thisMonthCount = thisMonthCount;
    this.firstPrimedAt = firstPrimedAt;
    this.lastPrimedAt = lastPrimedAt;
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
    if (this.totalCount !== null && this.totalCount !== undefined) {
      return this.totalCount;
    }
    return this.primeTimestamps.length;
  }

  /**
   * Get count of primes today.
   */
  getTodayCount() {
    if (this.todayCount !== null && this.todayCount !== undefined) {
      return this.todayCount;
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= todayMs).length;
  }

  /**
   * Get count of primes yesterday.
   */
  getYesterdayCount() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayMs = yesterdayStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= yesterdayMs && ts < todayMs).length;
  }

  /**
   * Get count of primes this week (week starts on Sunday).
   */
  getThisWeekCount() {
    if (this.thisWeekCount !== null && this.thisWeekCount !== undefined) {
      return this.thisWeekCount;
    }
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= weekStartMs).length;
  }

  /**
   * Get count of primes last week (week starts on Sunday).
   */
  getLastWeekCount() {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekStartMs = thisWeekStart.getTime();

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartMs = lastWeekStart.getTime();

    return this.primeTimestamps.filter((ts) => ts >= lastWeekStartMs && ts < thisWeekStartMs).length;
  }

  /**
   * Get count of primes this month.
   */
  getThisMonthCount() {
    if (this.thisMonthCount !== null && this.thisMonthCount !== undefined) {
      return this.thisMonthCount;
    }
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
    if (this.primeTimestamps.length > 0) {
      const firstTimestamp = Math.min(...this.primeTimestamps);
      return new Date(firstTimestamp);
    }
    if (this.firstPrimedAt) return new Date(this.firstPrimedAt);
    return null;
  }

  /**
   * Get the last time this item was primed.
   * @returns {Date|null}
   */
  getLastPrimeDate() {
    if (this.primeTimestamps.length > 0) {
      const lastTimestamp = Math.max(...this.primeTimestamps);
      return new Date(lastTimestamp);
    }
    if (this.lastPrimedAt) return new Date(this.lastPrimedAt);
    return null;
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
