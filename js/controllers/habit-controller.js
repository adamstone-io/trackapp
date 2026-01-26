// controllers/habit-controller.js
import { Habit } from "../domain/habit.js";
import { HabitView } from "../views/habit-view.js";

const STORAGE_KEY = "habits";
const RESET_TIMESTAMPS_KEY = "habit-reset-timestamps";

export class HabitController {
  constructor() {
    this.view = new HabitView();
    this.habits = this.loadHabits();
    this.checkAndResetCounts();
  }

  init() {
    this.render();
    
    // Set up add button
    const addBtn = document.getElementById("add-habit-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.view.openAddModal((formData) => this.addHabit(formData));
      });
    }
  }

  loadHabits() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return parsed.map(item => Habit.fromJSON(item)).filter(h => h.isActive);
    } catch (error) {
      console.error("Failed to load habits:", error);
      return [];
    }
  }

  saveHabits() {
    try {
      // Load all habits (including archived ones)
      const allData = localStorage.getItem(STORAGE_KEY);
      let allHabits = allData ? JSON.parse(allData) : [];
      
      // Update active habits
      this.habits.forEach(habit => {
        const index = allHabits.findIndex(h => h.id === habit.id);
        if (index >= 0) {
          allHabits[index] = habit.toJSON();
        } else {
          allHabits.push(habit.toJSON());
        }
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allHabits));
    } catch (error) {
      console.error("Failed to save habits:", error);
    }
  }

  addHabit({ name, dailyTarget, weeklyTarget }) {
    if (!name) return;
    
    const habit = new Habit({
      name,
      dailyTarget,
      weeklyTarget,
    });
    
    this.habits.push(habit);
    this.saveHabits();
    this.render();
  }

  logHabit(habitId) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    habit.increment(1);
    this.saveHabits();
    this.render();
  }

  editHabit(habitId, { name, dailyTarget, weeklyTarget }) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    habit.name = name;
    habit.targets.daily = dailyTarget;
    habit.targets.weekly = weeklyTarget;
    
    this.saveHabits();
    this.render();
  }

  deleteHabit(habitId) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const confirmed = confirm(`Are you sure you want to delete "${habit.name}"?`);
    if (!confirmed) return;
    
    // Remove from active habits
    this.habits = this.habits.filter(h => h.id !== habitId);
    
    // Remove from storage completely
    try {
      const allData = localStorage.getItem(STORAGE_KEY);
      if (allData) {
        let allHabits = JSON.parse(allData);
        allHabits = allHabits.filter(h => h.id !== habitId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allHabits));
      }
    } catch (error) {
      console.error("Failed to delete habit:", error);
    }
    
    this.render();
  }

  archiveHabit(habitId) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    if (habit.isActive) {
      habit.deactivate();
      this.habits = this.habits.filter(h => h.id !== habitId);
    } else {
      habit.activate();
      this.habits.push(habit);
    }
    
    this.saveHabits();
    this.render();
  }

  checkAndResetCounts() {
    const now = new Date();
    const timestamps = this.loadResetTimestamps();
    
    let needsSave = false;
    
    // Check daily reset
    const lastDaily = timestamps.lastDailyReset 
      ? new Date(timestamps.lastDailyReset) 
      : null;
    
    if (!lastDaily || !this.isSameDay(lastDaily, now)) {
      this.habits.forEach(habit => habit.resetDaily());
      timestamps.lastDailyReset = this.getStartOfDay(now).toISOString();
      needsSave = true;
    }
    
    // Check weekly reset (Monday = start of week)
    const lastWeekly = timestamps.lastWeeklyReset 
      ? new Date(timestamps.lastWeeklyReset) 
      : null;
    
    if (!lastWeekly || !this.isSameWeek(lastWeekly, now)) {
      this.habits.forEach(habit => habit.resetWeekly());
      timestamps.lastWeeklyReset = this.getStartOfWeek(now).toISOString();
      needsSave = true;
    }
    
    if (needsSave) {
      this.saveResetTimestamps(timestamps);
      this.saveHabits();
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
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
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
        const habit = this.habits.find(h => h.id === id);
        if (habit) {
          this.view.openEditModal(habit, (formData) => this.editHabit(id, formData));
        }
      },
      onDelete: (id) => this.deleteHabit(id),
      onArchive: (id) => this.archiveHabit(id)
    });
  }
}
