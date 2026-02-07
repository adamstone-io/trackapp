// study-main.js
import { createStudyController } from "./controllers/study-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  // Initialize navigation
  initNavigation();

  // Register sound for logging study sessions
  SoundManager.register(
    "studyLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const studyController = createStudyController();

  // Debug mode
  if (window.location.hostname === "localhost") {
    window.debug = {
      studyController,
    };
  }
});
