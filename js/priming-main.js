// priming-main.js
import { createPrimeController } from "./controllers/prime-controller.js";

document.addEventListener("DOMContentLoaded", () => {
  const primeController = createPrimeController();

  // Debug mode
  if (window.location.hostname === "localhost") {
    window.debug = {
      primeController,
    };
  }
});
