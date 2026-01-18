// main.js
import { createTimerController } from "./controllers/timer-controller.js";
import { createMomentController } from "./controllers/moment-controller.js";
import { createDataManagementController } from "./controllers/data-management-controller.js";
import { createEntriesController } from "./controllers/list-entries-controller.js";
import { createCountdownController } from "./controllers/countdown-controller.js";
import { createMainTimeEntryWindowController } from "./controllers/main-time-entry-window.js";
import { createManualEntryController } from "./controllers/manual-time-entry-controller.js";

document.addEventListener("DOMContentLoaded", () => {
    const timerDispose = createTimerController();
    const momentDispose = createMomentController();
    const dataDispose = createDataManagementController();
    const entriesController = createEntriesController();
    const countdownDispose = createCountdownController();

    const manualEntryController = createManualEntryController({
        onEntryAdded: () => {
            entriesController.refresh();
        },
    });

    createMainTimeEntryWindowController({
        onManualEntrySaved: (manualEntry) => {
            manualEntryController.addManualEntry(manualEntry);
        },
    });

    if (window.location.hostname === "localhost") {
        window.debug = {
            timerDispose,
            momentDispose,
            dataDispose,
            countdownDispose,
        };
    }
});
