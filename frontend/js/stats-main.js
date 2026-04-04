// js/stats-main.js
import { createStatsController } from "./controllers/stats-controller.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

(async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = '';
  initNavigation();

  createStatsController();
})();
