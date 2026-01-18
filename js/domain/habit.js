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
    }) {
        this.id = id ?? crypto.randomUUID();
        this.name = name;

        // Targets
        this.targets = {
            daily: dailyTarget,
            weekly: weeklyTarget,
            monthly: monthlyTarget,
        };

        // Progress counters
        this.counts = {
            daily: counts.daily ?? 0,
            weekly: counts.weekly ?? 0,
            monthly: counts.monthly ?? 0,
        };

        this.isActive = isActive;
        this.createdAt = new Date(createdAt);
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
        return this.targets.daily > 0 &&
               this.counts.daily >= this.targets.daily;
    }

    isWeeklyComplete() {
        return this.targets.weekly > 0 &&
               this.counts.weekly >= this.targets.weekly;
    }

    isMonthlyComplete() {
        return this.targets.monthly > 0 &&
               this.counts.monthly >= this.targets.monthly;
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
        };
    }

    static fromJSON(data) {
        return new Habit({
            id: data.id,
            name: data.name,
            dailyTarget: data.targets?.daily,
            weeklyTarget: data.targets?.weekly,
            monthlyTarget: data.targets?.monthly,
            counts: data.counts,
            isActive: data.isActive,
            createdAt: data.createdAt,
        });
    }
}
