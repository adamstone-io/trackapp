// js/habits-main.js
import { initNavigation } from "./controllers/nav-controller.js";
import { HabitController } from "./controllers/habit-controller.js";

document.addEventListener("DOMContentLoaded", () => {
    // Initialize navigation
    initNavigation();
    
    // Initialize habits
    const habitController = new HabitController();
    habitController.init();
});
