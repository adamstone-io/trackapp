// views/moment-view.js
import { byId, on, show, hide } from "../ui/ui-core.js";
import { momentIds } from "../ui/moment-ids.js";

export const MomentView = {
  modal: () => byId(momentIds.momentModal),
  descriptionInput: () => byId(momentIds.momentDescriptionInput),
  categorySelect: () => byId(momentIds.momentCategorySelect),
  saveBtn: () => byId(momentIds.momentSaveBtn),
  cancelBtn: () => byId(momentIds.momentCancelBtn),

  open() {
    show(this.modal());
    this.descriptionInput().focus();
  },

  close() {
    hide(this.modal());
    this.reset();
  },

  reset() {
    this.descriptionInput().value = "";
    this.categorySelect().value = "General";
  },

  readMoment() {
    return {
      description: this.descriptionInput().value.trim(),
      category: this.categorySelect().value,
      isMilestone: false,
    };
  },

  bind({ onSave, onCancel }) {
    const unbinds = [
      on(this.saveBtn(), "click", (e) => {
        e.preventDefault();
        onSave();
      }),
      on(this.cancelBtn(), "click", (e) => {
        e.preventDefault();
        onCancel();
      }),
    ];
    return () => unbinds.forEach((u) => u());
  },
};
