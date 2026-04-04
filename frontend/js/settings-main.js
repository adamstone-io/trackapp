import { ensureAuthenticated } from "./api/authApi.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { createSettingsController } from "./controllers/settings-controller.js";

(async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = "";
  initNavigation();
  createSettingsController();
})();
