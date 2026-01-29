// js/workspace-main.js
import { createWorkspaceController } from "./controllers/workspace-controller.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  // Initialize navigation
  initNavigation();

  createWorkspaceController();
});
