// priming-main.js
import { createPrimeController } from "./controllers/prime-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  // Initialize navigation
  initNavigation();
  SoundManager.register(
    "primeLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const primeController = createPrimeController();

  // Debug mode
  if (window.location.hostname === "localhost") {
    window.debug = {
      primeController,
    };
  }
});
