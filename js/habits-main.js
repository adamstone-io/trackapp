// js/habits-main.js
import { initNavigation } from "./controllers/nav-controller.js";
import { HabitController } from "./controllers/habit-controller.js";
import { SoundManager } from "./utils/sound-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    // Initialize navigation
    initNavigation();
    
    // Register success sound
    SoundManager.register(
        "habitLogged",
        "../sounds/timer-finished/success-tone/success-tone.mp3",
        { volume: 0.9 }
    );
    
    // Initialize habits
    const habitController = new HabitController();
    habitController.init();
});
