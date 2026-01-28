// views/habit-view.js
import { createDropdownMenu } from "./components/dropdown-menu.js";

export class HabitView {
  constructor() {
    this.container = document.getElementById("habits-list");
    this.addModal = document.getElementById("add-habit-modal");
    this.addForm = document.getElementById("add-habit-form");
    this.addBtn = document.getElementById("add-habit-btn");
    this.cancelBtn = document.getElementById("add-habit-cancel-btn");
    
    // Edit modal
    this.editModal = document.getElementById("edit-habit-modal");
    this.editForm = document.getElementById("edit-habit-form");
    this.editCancelBtn = document.getElementById("edit-habit-cancel-btn");
    
    this.dropdownMenus = [];
    
    this.bindModalEvents();
  }

  bindModalEvents() {
    // Add modal
    if (this.addBtn) {
      this.addBtn.addEventListener("click", () => this.openAddModal());
    }
    
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener("click", () => this.closeAddModal());
    }
    
    // Edit modal
    if (this.editCancelBtn) {
      this.editCancelBtn.addEventListener("click", () => this.closeEditModal());
    }
    
    // Close modals on backdrop click
    [this.addModal, this.editModal].forEach(modal => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.classList.add("hidden");
          }
        });
      }
    });
  }

  renderHabits(habits, callbacks) {
    // Dispose existing dropdowns
    this.dropdownMenus.forEach(menu => menu.dispose());
    this.dropdownMenus = [];
    
    if (!this.container) return;
    
    if (habits.length === 0) {
      this.container.innerHTML = `
        <div class="habits-empty">
          <div class="habits-empty__icon">🎯</div>
          <p class="habits-empty__text">No habits yet</p>
          <p>Click "Add Habit" to get started</p>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = "";
    
    habits.forEach(habit => {
      const card = this.createHabitCard(habit, callbacks);
      this.container.appendChild(card);
    });
  }

  createHabitCard(habit, { onLog, onEdit, onDelete, onArchive }) {
    const card = document.createElement("div");
    card.className = "habit-card";
    card.dataset.habitId = habit.id;
    
    // Check if targets are complete
    const isDailyComplete = habit.isDailyComplete();
    const isWeeklyComplete = habit.isWeeklyComplete();
    
    card.innerHTML = `
      <div class="habit-card__header">
        <h3 class="habit-card__title">${this.escapeHtml(habit.name)}</h3>
        <button class="icon-btn" aria-label="Options" data-menu-trigger>
          <svg class="icon" viewBox="0 0 16 16">
            <circle cx="2" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="14" cy="8" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
      
      <div class="habit-card__stats">
        <div class="habit-stat ${isDailyComplete ? 'habit-stat--complete' : ''}">
          <span class="habit-stat__label">Daily</span>
          <span class="habit-stat__value">${habit.counts.daily} / ${habit.targets.daily}</span>
        </div>
        <div class="habit-stat ${isWeeklyComplete ? 'habit-stat--complete' : ''}">
          <span class="habit-stat__label">Weekly</span>
          <span class="habit-stat__value">${habit.counts.weekly} / ${habit.targets.weekly}</span>
        </div>
      </div>
      
      <button class="btn btn--primary habit-card__log-btn" data-log-btn>
        Log +1
      </button>
    `;
    
    // Attach log button handler
    const logBtn = card.querySelector("[data-log-btn]");
    logBtn.addEventListener("click", () => onLog(habit.id));
    
    // Attach dropdown menu
    const menuTrigger = card.querySelector("[data-menu-trigger]");
    const dropdown = createDropdownMenu({
      items: [
        {
          label: "Edit",
          onSelect: () => onEdit(habit.id)
        },
        {
          label: habit.isActive ? "Archive" : "Unarchive",
          onSelect: () => onArchive(habit.id)
        },
        {
          label: "Delete",
          onSelect: () => onDelete(habit.id)
        }
      ]
    });
    dropdown.attachTo(menuTrigger);
    this.dropdownMenus.push(dropdown);
    
    return card;
  }

  openAddModal(onSubmit) {
    if (!this.addModal || !this.addForm) return;
    
    this.addModal.classList.remove("hidden");
    this.addForm.reset();
    
    // Remove old event listener and add new one
    const newForm = this.addForm.cloneNode(true);
    this.addForm.parentNode.replaceChild(newForm, this.addForm);
    this.addForm = newForm;
    
    this.addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = this.readAddForm();
      if (onSubmit) {
        onSubmit(formData);
      }
      this.closeAddModal();
    });
    
    // Re-bind cancel button
    this.cancelBtn = document.getElementById("add-habit-cancel-btn");
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener("click", () => this.closeAddModal());
    }
    
    // Focus first input
    const firstInput = this.addForm.querySelector("input");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  closeAddModal() {
    if (this.addModal) {
      this.addModal.classList.add("hidden");
    }
  }

  openEditModal(habit, onSubmit) {
    if (!this.editModal || !this.editForm) return;
    
    this.editModal.classList.remove("hidden");
    
    // Populate form
    document.getElementById("edit-habit-name").value = habit.name;
    document.getElementById("edit-daily-target").value = habit.targets.daily;
    document.getElementById("edit-weekly-target").value = habit.targets.weekly;
    
    // Remove old event listener and add new one
    const newForm = this.editForm.cloneNode(true);
    this.editForm.parentNode.replaceChild(newForm, this.editForm);
    this.editForm = newForm;
    
    this.editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = this.readEditForm();
      if (onSubmit) {
        onSubmit(formData);
      }
      this.closeEditModal();
    });
    
    // Re-bind cancel button
    this.editCancelBtn = document.getElementById("edit-habit-cancel-btn");
    if (this.editCancelBtn) {
      this.editCancelBtn.addEventListener("click", () => this.closeEditModal());
    }
    
    // Focus first input
    const firstInput = this.editForm.querySelector("input");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  closeEditModal() {
    if (this.editModal) {
      this.editModal.classList.add("hidden");
    }
  }

  readAddForm() {
    return {
      name: document.getElementById("habit-name").value.trim(),
      dailyTarget: parseInt(document.getElementById("daily-target").value) || 0,
      weeklyTarget: parseInt(document.getElementById("weekly-target").value) || 0
    };
  }

  readEditForm() {
    return {
      name: document.getElementById("edit-habit-name").value.trim(),
      dailyTarget: parseInt(document.getElementById("edit-daily-target").value) || 0,
      weeklyTarget: parseInt(document.getElementById("edit-weekly-target").value) || 0
    };
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  dispose() {
    this.dropdownMenus.forEach(menu => menu.dispose());
    this.dropdownMenus = [];
  }
}
