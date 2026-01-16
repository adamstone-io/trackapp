// main.js
import { createTimer } from "./controllers/timer-controller.js";
import { byId } from "./ui/ui-core.js";
import { ids } from "./ui/ids.js";

document.addEventListener("DOMContentLoaded", () => {
  const primaryTimer = createTimer();

  const nameEl = byId(ids.taskName);
  const categoryEl = byId(ids.taskCategory);
  function updateTitle() {
    const task = nameEl.value.trim();
    const category = categoryEl.value || "Other";
    primaryTimer.setTaskTitle(task ? `${task} • ${category}` : "");
  }
  nameEl.addEventListener("input", updateTitle);
  categoryEl.addEventListener("change", updateTitle);
  updateTitle();
});
