// domain/habit.js

/**
 * Habit domain object
 *
 * Represents a recurring behavior with multiple time-based targets.
 * Counts are stored inside the object and updated through methods
 * to preserve invariants.
 */
export class Habit {
  constructor({
    id,
    name,
    dailyTarget = 0,
    weeklyTarget = 0,
    monthlyTarget = 0,
    isActive = true,
    counts = {},
    createdAt = new Date(),
    streakCount = 0,
    lastCompletedDate = null,
  }) {
    this.id = id ?? crypto.randomUUID();
    this.name = name;

    this.targets = {
      daily: dailyTarget,
      weekly: weeklyTarget,
      monthly: monthlyTarget,
    };

    this.counts = {
      daily: counts.daily ?? 0,
      weekly: counts.weekly ?? 0,
      monthly: counts.monthly ?? 0,
    };

    this.isActive = isActive;
    this.createdAt = new Date(createdAt);
    this.streakCount = streakCount;
    this.lastCompletedDate = lastCompletedDate;
  }

  /* ----------------------------
       Status
    ----------------------------- */

  activate() {
    this.isActive = true;
  }

  deactivate() {
    this.isActive = false;
  }

  /* ----------------------------
       Progress updates
    ----------------------------- */

  increment(amount = 1) {
    if (!this.isActive) {
      return;
    }

    this.counts.daily += amount;
    this.counts.weekly += amount;
    this.counts.monthly += amount;
  }

  resetDaily() {
    this.counts.daily = 0;
  }

  resetWeekly() {
    this.counts.weekly = 0;
  }

  resetMonthly() {
    this.counts.monthly = 0;
  }

  /* ----------------------------
       Completion checks
    ----------------------------- */

  isDailyComplete() {
    return this.targets.daily > 0 && this.counts.daily >= this.targets.daily;
  }

  isWeeklyComplete() {
    return this.targets.weekly > 0 && this.counts.weekly >= this.targets.weekly;
  }

  isMonthlyComplete() {
    return (
      this.targets.monthly > 0 && this.counts.monthly >= this.targets.monthly
    );
  }

  /* ----------------------------
       Serialization
    ----------------------------- */

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      targets: { ...this.targets },
      counts: { ...this.counts },
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      streakCount: this.streakCount,
      lastCompletedDate: this.lastCompletedDate,
    };
  }

  static fromJSON(data = {}) {
    const dailyTarget =
      data.dailyTarget ?? data.daily_target ?? data.targets?.daily ?? 0;
    const weeklyTarget =
      data.weeklyTarget ?? data.weekly_target ?? data.targets?.weekly ?? 0;
    const monthlyTarget =
      data.monthlyTarget ?? data.monthly_target ?? data.targets?.monthly ?? 0;

    const counts = data.counts ?? {
      daily: data.dailyCount ?? data.daily_count ?? 0,
      weekly: data.weeklyCount ?? data.weekly_count ?? 0,
      monthly: data.monthlyCount ?? data.monthly_count ?? 0,
    };

    const isActive = data.isActive ?? data.is_active ?? true;
    const createdAt = data.createdAt ?? data.created_at ?? null;

    const streakCount = data.streakCount ?? data.streak_count ?? 0;
    const lastCompletedDate =
      data.lastCompletedDate ?? data.last_completed_date ?? null;

    return new Habit({
      id: data.id,
      name: data.name,
      dailyTarget,
      weeklyTarget,
      monthlyTarget,
      counts,
      isActive,
      createdAt,
      streakCount,
      lastCompletedDate,
    });
  }
}
