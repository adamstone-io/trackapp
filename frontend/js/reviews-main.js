// reviews-main.js
import { createReviewController } from "./controllers/review-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  // Initialize navigation
  initNavigation();

  // Register sound for logging reviews
  SoundManager.register(
    "reviewLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const reviewController = createReviewController();

  // Debug mode
  if (window.location.hostname === "localhost") {
    window.debug = {
      reviewController,
    };
  }
});
