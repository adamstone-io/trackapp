import { byId, show, hide } from "../ui/ui-core.js";
import { taskIds } from "../ui/task-ids.js";

export const CurrentTaskView = {
  inputSection: () => byId(taskIds.taskInputSection),
  nameInput: () => byId(taskIds.taskNameInput),
  categorySelect: () => byId(taskIds.taskCategorySelect),

  /**
   * Render the current task section.
   * Makes task name input readonly when timer is running.
   */
  render({ taskTitle, running }) {
    const nameInput = this.nameInput();
    const categorySelect = this.categorySelect();
    
    if (running) {
      nameInput.setAttribute('readonly', 'readonly');
      categorySelect.setAttribute('disabled', 'disabled');
    } else {
      nameInput.removeAttribute('readonly');
      categorySelect.removeAttribute('disabled');
    }
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

  clearInputs() {
    this.nameInput().value = "";
    this.categorySelect().value = "";
  }
};
