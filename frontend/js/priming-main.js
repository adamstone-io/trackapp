import { createPrimeController } from "./controllers/prime-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./api/authApi.js";

(async () => {
  const isAuth = await ensureAuthenticated();
  if (!isAuth) return;
  document.body.style.visibility = '';

  initNavigation();

  const primeController = createPrimeController();

  SoundManager.register(
    "primeLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );
  if (window.location.hostname === "localhost") {
    window.debug = { primeController };
  }
})();
