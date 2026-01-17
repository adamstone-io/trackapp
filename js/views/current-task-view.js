import { byId, show, hide } from "../ui/ui-core.js";
import { taskIds } from "../ui/task-ids.js";

export const CurrentTaskView = {
  title: () => byId(taskIds.currentTaskTitle),
  inputSection: () => byId(taskIds.taskInputSection),
  nameInput: () => byId(taskIds.taskNameInput),
  categorySelect: () => byId(taskIds.taskCategorySelect),

  /**
   * Render the current task section.
   * Hides task input while the timer is running.
   */
  render({ taskTitle, running }) {
    this.title().textContent = taskTitle || "No active task";
    running ? hide(this.inputSection()) : show(this.inputSection());
  },

  /**
   * Read the task input fields.
   */
  readTask() {
    return {
      title: this.nameInput().value.trim(),
      category: this.categorySelect().value || "Other",
    };
  },
};
