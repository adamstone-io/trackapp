// study-main.js
import { createStudyController } from "./controllers/study-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

(async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = '';
  initNavigation();

  SoundManager.register(
    "studyLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const studyController = createStudyController();

  if (window.location.hostname === "localhost") {
    window.debug = { studyController };
  }
})();
