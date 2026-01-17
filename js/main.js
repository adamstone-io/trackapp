// main.js
import { createTimerController } from "./controllers/timer-controller.js";
import { createMomentController } from "./controllers/moment-controller.js";
import { createDataManagementController } from "./controllers/data-management-controller.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize controllers
  const timerDispose = createTimerController();
  const momentDispose = createMomentController();
  const dataDispose = createDataManagementController();

  // Optional: expose for debugging
  if (window.location.hostname === "localhost") {
    window.debug = { timerDispose, momentDispose, dataDispose };
  }
});
