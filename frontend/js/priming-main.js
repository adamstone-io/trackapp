// priming-main.js
import { createPrimeController } from "./controllers/prime-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated, loadPrimeItemsPage } from "./data/storage.js";

const authReady = ensureAuthenticated();
const initialPrimePagePromise = authReady.then((ok) =>
  ok ? loadPrimeItemsPage() : null
);

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await authReady)) return;
  // Initialize navigation
  initNavigation();
  SoundManager.register(
    "primeLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const primeController = createPrimeController({
    initialPagePromise: initialPrimePagePromise,
  });

  // Debug mode
  if (window.location.hostname === "localhost") {
    window.debug = {
      primeController,
    };
  }
});
