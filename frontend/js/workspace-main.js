// js/workspace-main.js
import { createWorkspaceController } from "./controllers/workspace-controller.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = '';
  // Initialize navigation
  initNavigation();

  createWorkspaceController();
});
