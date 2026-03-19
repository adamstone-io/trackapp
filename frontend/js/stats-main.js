// js/stats-main.js
import { createStatsController } from "./controllers/stats-controller.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = '';
  // Initialize navigation
  initNavigation();

  createStatsController();
});
