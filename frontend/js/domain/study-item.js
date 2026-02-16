/**
 * StudyItem represents a unified learning item that can be in one of three modes:
 * - Priming: Initial exposure to new concepts
 * - Studying: Active learning and practice
 * - Reviewing: Reinforcement and retention
 *
 * Replaces the old PrimeItem, StudyItem, and ReviewItem classes.
 */

export class StudyItem {
  constructor({
    id,
    prompt,
    notes = "",
    category = "",
    image = null,
    imageUrl = null,
    isPriming = false,
    isStudying = false,
    isReviewing = false,
    mode = "none",
    primeCount = 0,
    studyCount = 0,
    reviewCount = 0,
    firstPrimedAt = null,
    lastPrimedAt = null,
    firstStudiedAt = null,
    lastStudiedAt = null,
    firstReviewedAt = null,
    lastReviewedAt = null,
    todayCount = 0,
    weekCount = 0,
    monthCount = 0,
    isArchived = false,
    createdAt = null,
  }) {
    this.id = id;
    this.prompt = prompt?.trim() || "";
    this.notes = notes?.trim() || "";
    this.category = category?.trim().toLowerCase() || "";
    this.image = image;
    this.imageUrl = imageUrl;

    this.isPriming = isPriming;
    this.isStudying = isStudying;
    this.isReviewing = isReviewing;
    this.mode = mode;

    this.primeCount = primeCount;
    this.studyCount = studyCount;
    this.reviewCount = reviewCount;

    this.firstPrimedAt = firstPrimedAt;
    this.lastPrimedAt = lastPrimedAt;
    this.firstStudiedAt = firstStudiedAt;
    this.lastStudiedAt = lastStudiedAt;
    this.firstReviewedAt = firstReviewedAt;
    this.lastReviewedAt = lastReviewedAt;

    this.todayCount = todayCount;
    this.weekCount = weekCount;
    this.monthCount = monthCount;

    this.isArchived = isArchived;
    this.createdAt = createdAt;
  }

  /**
   * Get total count accross all modes.
   */
  getTotalCount() {
    return this.primeCount + this.studyCount + this.reviewCount;
  }

  /**
   * Get count for current mode.
   */
  getCurrentModeCount() {
    if (this.isPriming) return this.primeCount;
    if (this.isStudying) return this.studyCount;
    if (this.isReviewing) return this.reviewCount;
    return 0;
  }

  /**
   * Get todays cont for current mode
   * @returns {number}
   */
  getTodayCount() {
    return this.todayCount;
  }

  /**
   * Get weeks count for current mode
   * @returns {number}
   */
  getWeekCount() {
    return this.weekCount;
  }

  /**
   * Get this week's count for current mode
   */
  getMonthCount() {
    return this.monthCount;
  }

  getLastInteractionDate() {
    if (this.isPriming && this.lastPrimedAt) return new Date(this.lastPrimedAt);
    if (this.isStudying && this.lastStudiedAt)
      return new Date(this.lastStudiedAt);
    if (this.isReviewing && this.lastReviewedAt)
      return new Date(this.lastReviewedAt);
    return null;
  }

  /**
   * Get first interaction date based on current mode
   */
  getFirstInteractionDate() {
    if (this.isPriming && this.firstPrimedAt)
      return new Date(this.firstPrimedAt);
    if (this.isStudying && this.firstStudiedAt)
      return new Date(this.firstStudiedAt);
    if (this.isReviewing && this.firstReviewedAt)
      return new Date(this.firstReviewedAt);
    return null;
  }

  /**
   * Get a human-readable "time ago" string for last interaction
   */
  getFirstInteractionTimeAgo() {
    const lastDate = this.getLastInteractionDate();
    if (!lastDate) return "Never";
    return this._formatTimeAgo(lastDate);
  }

  getLastPrimedTimeAgo() {
    if (!this.lastPrimedAt) return "Never";
    return this._formatTimeAgo(new Date(this.lastPrimedAt));
  }

  getFirstPrimedTimeAgo() {
    if (!this.firstPrimedAt) return "Never";
    return this._formatTimeAgo(new Date(this.firstPrimedAt));
  }

  getLastStudiedTimeAgo() {
    if (!this.lastStudiedAt) return "Never";
    return this._formatTimeAgo(new Date(this.lastStudiedAt));
  }

  getFirstStudiedTimeAgo() {
    if (!this.firstStudiedAt) return "Never";
    return this._formatTimeAgo(new Date(this.firstStudiedAt));
  }

  getLastReviewedTimeAgo() {
    if (!this.lastReviewedAt) return "Never";
    return this._formatTimeAgo(new Date(this.lastReviewedAt));
  }

  getFirstReviewedTimeAgo() {
    if (!this.firstReviewedAt) return "Never";
    return this._formatTimeAgo(new Date(this.firstReviewedAt));
  }

  /**
   * Format a date as "time ago" string
   */
  _formatTimeAgo(date) {
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString();
  }

  archive() {
    this.isArchived = true;
  }

  restore() {
    this.isArchived = false;
  }

  update({ prompt, notes, category, image }) {
    if (prompt !== undefined) this.prompt = prompt.trim();
    if (notes !== undefined) this.notes = notes.trim();
    if (category !== undefined) this.category = category.trim().toLowerCase();
    if (image !== undefined) this.image = image;
  }

  toJSON() {
    return {
      id: this.id,
      prompt: this.prompt,
      notes: this.notes,
      category: this.category,
      is_priming: this.isPriming,
      is_studying: this.isStudying,
      is_reviewing: this.isReviewing,
      is_archived: this.isArchived,
    };
  }

  static fromJSON(data) {
    return new StudyItem({
      id: data.id,
      prompt: data.prompt,
      notes: data.notes,
      category: data.category,
      image: data.image,
      imageUrl: data.image_url || data.imageUrl,
      isPriming: data.is_priming ?? data.isPriming,
      isStudying: data.is_studying ?? data.isStudying,
      isReviewing: data.is_reviewing ?? data.isReviewing,
      mode: data.mode,
      interactionTimestamps:
        data.interaction_timestamps || data.interactionTimestamps || [],
      primeCount: data.prime_count ?? data.primeCount ?? 0,
      studyCount: data.study_count ?? data.studyCount ?? 0,
      reviewCount: data.review_count ?? data.reviewCount ?? 0,
      firstPrimedAt: data.first_primed_at ?? data.firstPrimedAt,
      lastPrimedAt: data.last_primed_at ?? data.lastPrimedAt,
      firstStudiedAt: data.first_studied_at ?? data.firstStudiedAt,
      lastStudiedAt: data.last_studied_at ?? data.lastStudiedAt,
      firstReviewedAt: data.first_reviewed_at ?? data.firstReviewedAt,
      lastReviewedAt: data.last_reviewed_at ?? data.lastReviewedAt,
      totalInteractions: data.total_interactions ?? data.totalInteractions ?? 0,
      todayCount: data.today_count ?? data.todayCount ?? 0,
      weekCount: data.week_count ?? data.weekCount ?? 0,
      monthCount: data.month_count ?? data.monthCount ?? 0,
      isArchived: data.is_archived ?? data.isArchived ?? false,
      createdAt: data.created_at || data.createdAt,
    });
  }
}
