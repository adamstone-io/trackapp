// controllers/habit-controller.js
import { Habit } from "../domain/habit.js";
import { HabitView } from "../views/habit-view.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  loadHabits,
  createHabit,
  updateHabit,
  deleteHabit,
} from "../data/storage.js";

const RESET_TIMESTAMPS_KEY = "habit-reset-timestamps";

export class HabitController {
  constructor() {
    this.view = new HabitView();
    this.habits = [];
  }

  async init() {
    await this.refreshHabits();
    await this.checkAndResetCounts();
    this.render();

    // Set up add button
    const addBtn = document.getElementById("add-habit-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.view.openAddModal((formData) => this.addHabit(formData));
      });
    }
  }

  async refreshHabits() {
    try {
      const habits = await loadHabits();
      this.habits = habits.filter((habit) => habit.isActive);
    } catch (error) {
      console.error("Failed to load habits:", error);
      this.habits = [];
    }
  }

  async addHabit({ name, dailyTarget, weeklyTarget }) {
    if (!name) return;

    const habit = new Habit({
      name,
      dailyTarget,
      weeklyTarget,
    });

    try {
      await createHabit(habit.toJSON());
      await this.refreshHabits();
      this.render();
    } catch (error) {
      console.error("Failed to add habit:", error);
      alert("Failed to add habit. Please try again.");
    }
  }

  async logHabit(habitId) {
    const habit = this.habits.find((h) => h.id === habitId);
    if (!habit) return;

    habit.increment(1);

    try {
      await updateHabit(habit.id, {
        dailyCount: habit.counts.daily,
        weeklyCount: habit.counts.weekly,
        monthlyCount: habit.counts.monthly,
      });

      // Play success sound
      SoundManager.play("habitLogged");

      this.render();
    } catch (error) {
      console.error("Failed to log habit:", error);
      alert("Failed to log habit. Please try again.");
    }
  }

  async editHabit(habitId, { name, dailyTarget, weeklyTarget }) {
    const habit = this.habits.find((h) => h.id === habitId);
    if (!habit) return;

    habit.name = name;
    habit.targets.daily = dailyTarget;
    habit.targets.weekly = weeklyTarget;

    try {
      await updateHabit(habit.id, {
        name: habit.name,
        dailyTarget: habit.targets.daily,
        weeklyTarget: habit.targets.weekly,
        monthlyTarget: habit.targets.monthly,
      });
      await this.refreshHabits();
      this.render();
    } catch (error) {
      console.error("Failed to edit habit:", error);
      alert("Failed to edit habit. Please try again.");
    }
  }

  async deleteHabit(habitId) {
    const habit = this.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${habit.name}"?`,
    );
    if (!confirmed) return;

    try {
      await deleteHabit(habit.id);
      await this.refreshHabits();
      this.render();
    } catch (error) {
      console.error("Failed to delete habit:", error);
      alert("Failed to delete habit. Please try again.");
    }
  }

  async archiveHabit(habitId) {
    const habit = this.habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.isActive) {
      habit.deactivate();
    } else {
      habit.activate();
    }

    try {
      await updateHabit(habit.id, { isActive: habit.isActive });
      await this.refreshHabits();
      this.render();
    } catch (error) {
      console.error("Failed to archive habit:", error);
      alert("Failed to archive habit. Please try again.");
    }
  }

  async checkAndResetCounts() {
    const now = new Date();
    const timestamps = this.loadResetTimestamps();

    let needsSave = false;

    // Check daily reset
    const lastDaily = timestamps.lastDailyReset
      ? new Date(timestamps.lastDailyReset)
      : null;

    if (!lastDaily || !this.isSameDay(lastDaily, now)) {
      this.habits.forEach((habit) => habit.resetDaily());
      timestamps.lastDailyReset = this.getStartOfDay(now).toISOString();
      needsSave = true;
    }

    // Check weekly reset (Monday = start of week)
    const lastWeekly = timestamps.lastWeeklyReset
      ? new Date(timestamps.lastWeeklyReset)
      : null;

    if (!lastWeekly || !this.isSameWeek(lastWeekly, now)) {
      this.habits.forEach((habit) => habit.resetWeekly());
      timestamps.lastWeeklyReset = this.getStartOfWeek(now).toISOString();
      needsSave = true;
    }

    if (needsSave) {
      this.saveResetTimestamps(timestamps);
      try {
        await Promise.all(
          this.habits.map((habit) =>
            updateHabit(habit.id, {
              dailyCount: habit.counts.daily,
              weeklyCount: habit.counts.weekly,
              monthlyCount: habit.counts.monthly,
            }),
          ),
        );
        await this.refreshHabits();
      } catch (error) {
        console.error("Failed to reset habit counts:", error);
      }
    }
  }

  loadResetTimestamps() {
    try {
      const data = localStorage.getItem(RESET_TIMESTAMPS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Failed to load reset timestamps:", error);
      return {};
    }
  }

  saveResetTimestamps(timestamps) {
    try {
      localStorage.setItem(RESET_TIMESTAMPS_KEY, JSON.stringify(timestamps));
    } catch (error) {
      console.error("Failed to save reset timestamps:", error);
    }
  }

  isSameDay(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  isSameWeek(date1, date2) {
    const week1 = this.getStartOfWeek(date1);
    const week2 = this.getStartOfWeek(date2);
    return week1.getTime() === week2.getTime();
  }

  getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  render() {
    this.view.renderHabits(this.habits, {
      onLog: (id) => this.logHabit(id),
      onEdit: (id) => {
        const habit = this.habits.find((h) => h.id === id);
        if (habit) {
          this.view.openEditModal(habit, (formData) =>
            this.editHabit(id, formData),
          );
        }
      },
      onDelete: (id) => this.deleteHabit(id),
      onArchive: (id) => this.archiveHabit(id),
    });
  }
}
