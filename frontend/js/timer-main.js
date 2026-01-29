// main.js
import { createTimerController } from "./controllers/timer-controller.js";
import { createMomentController } from "./controllers/moment-controller.js";
import { createEntriesController } from "./controllers/list-entries-controller.js";
import { createCountdownController } from "./controllers/countdown-controller.js";
import { createMainTimeEntryWindowController } from "./controllers/main-time-entry-window.js";
import { createManualEntryController } from "./controllers/manual-time-entry-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated } from "./data/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await ensureAuthenticated())) return;
  // Initialize navigation
  initNavigation();
  SoundManager.register(
    "timerFinished",
    "../sounds/timer-finished/alert-04/alert-04-short.mp3",
    { volume: 0.9 },
  );

  const entriesController = createEntriesController();
  const countdownDispose = createCountdownController();
  const timerDispose = createTimerController({
    onEntryAdded: async () => {
      await entriesController.refresh();
    },
  });

  const momentController = createMomentController({
    onMomentsChanged: async () => {
      await entriesController.refresh();
    },
  });

  entriesController.setMomentEditor((moment) =>
    momentController.openEdit(moment),
  );

  const manualEntryController = createManualEntryController({
    onEntryAdded: async () => {
      await entriesController.refresh();
    },
  });

  createMainTimeEntryWindowController({
    onManualEntrySaved: async (manualEntry) => {
      await manualEntryController.addManualEntry(manualEntry);
    },
  });

  if (window.location.hostname === "localhost") {
    window.debug = {
      timerDispose,
      countdownDispose,
      momentController,
      entriesController,
      manualEntryController,
    };
  }
});
