// views/moment-view.js
import { byId, on, show, hide } from "../ui/ui-core.js";
import { momentIds } from "../ui/moment-ids.js";

export const MomentView = {
  modal: () => byId(momentIds.momentModal),
  modalTitle: () => byId(momentIds.momentModalTitle),
  descriptionInput: () => byId(momentIds.momentDescriptionInput),
  categorySelect: () => byId(momentIds.momentCategorySelect),
  timeInput: () => byId(momentIds.momentTimeInput),
  saveBtn: () => byId(momentIds.momentSaveBtn),
  cancelBtn: () => byId(momentIds.momentCancelBtn),

  open() {
    show(this.modal());
    this.descriptionInput().focus();
  },

  setMode(mode) {
    const title = this.modalTitle();
    if (title) {
      title.textContent = mode === "edit" ? "Edit Moment" : "Log Moment";
    }
    this.saveBtn().textContent = mode === "edit" ? "Save Changes" : "Save Moment";
  },

  close() {
    hide(this.modal());
    this.reset();
  },

  reset() {
    this.descriptionInput().value = "";
    this.categorySelect().value = "General";
    this.timeInput().value = "";
    this.setMode("create");
  },

  setForm({ description = "", category = "General" } = {}) {
    this.descriptionInput().value = description;
    this.categorySelect().value = category || "General";
  },

  openForCreate() {
    this.setMode("create");
    this.reset();
    this.open();
  },

  openForEdit(moment) {
    this.setMode("edit");
    this.setForm({
      description: moment?.description ?? "",
      category: moment?.category ?? "General",
    });
    if (moment && Number.isFinite(moment.timestampMs)) {
      const date = new Date(moment.timestampMs);
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      this.timeInput().value = `${hh}:${mm}`;
    } else {
      this.timeInput().value = "";
    }
    this.open();
  },

  readMoment() {
    return {
      description: this.descriptionInput().value.trim(),
      category: this.categorySelect().value,
      time: this.timeInput().value,
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
