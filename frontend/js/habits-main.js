// js/habits-main.js
import { initNavigation } from "./controllers/nav-controller.js";
import { HabitController } from "./controllers/habit-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { ensureAuthenticated } from "./api/authApi.js";

(async () => {
  if (!(await ensureAuthenticated())) return;
  document.body.style.visibility = '';
  initNavigation();

  SoundManager.register(
    "habitLogged",
    "../sounds/timer-finished/success-tone/success-tone.mp3",
    { volume: 0.9 },
  );

  const habitController = new HabitController();
  habitController.init();
})();
