// js/workspace-main.js
import { createWorkspaceController } from "./controllers/workspace-controller.js";
import { initNavigation } from "./controllers/nav-controller.js";

document.addEventListener("DOMContentLoaded", () => {
    // Initialize navigation
    initNavigation();
    
    createWorkspaceController();
});
