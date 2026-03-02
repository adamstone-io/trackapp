// main.js
import { createTimerController } from "./controllers/timer-controller.js";
import { createMomentController } from "./controllers/moment-controller.js";
import { createEntriesController } from "./controllers/list-entries-controller.js";
import { createCountdownController } from "./controllers/countdown-controller.js";
import { createMainTimeEntryWindowController } from "./controllers/main-time-entry-window.js";
import { createManualEntryController } from "./controllers/manual-time-entry-controller.js";
import { SoundManager } from "./utils/sound-manager.js";
import { initNavigation } from "./controllers/nav-controller.js";
import { ensureAuthenticated, loadTodayEntries, loadTasks } from "./data/storage.js";
import { TaskNameManager } from "./utils/task-name-manager.js";

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

  // Quick-add entry section
  const qaeTaskInput = document.getElementById("qae-task-name");
  const qaeTaskDropdown = document.getElementById("qae-task-name-dropdown");
  const qaeStartInput = document.getElementById("qae-start-time");
  const qaeEndInput = document.getElementById("qae-end-time");
  const qaeAddBtn = document.getElementById("qae-add-btn");
  const qaeError = document.getElementById("qae-error");

  const qaeTaskManager = qaeTaskInput && qaeTaskDropdown
    ? new TaskNameManager(qaeTaskInput, qaeTaskDropdown)
    : null;

  loadTasks()
    .then((tasks) => qaeTaskManager?.setTasks(tasks))
    .catch(() => {});

  function bindClockToggle(input, btn) {
    let suppress = false;

    btn.addEventListener("mousedown", (e) => {
      if (document.activeElement === input) {
        e.preventDefault();
        suppress = true;
        input.blur();
      }
    });

    btn.addEventListener("click", () => {
      if (suppress) {
        suppress = false;
        return;
      }
      input.focus();
      try { input.showPicker(); } catch {}
    });
  }

  const qaeStartBtn = document.getElementById("qae-start-btn");
  const qaeEndBtn = document.getElementById("qae-end-btn");
  if (qaeStartInput && qaeStartBtn) bindClockToggle(qaeStartInput, qaeStartBtn);
  if (qaeEndInput && qaeEndBtn) bindClockToggle(qaeEndInput, qaeEndBtn);

  function toTimeValue(isoString) {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function nowTimeValue() {
    return toTimeValue(new Date().toISOString());
  }

  function addMinutes(timeValue, minutes) {
    const [hh, mm] = timeValue.split(":").map(Number);
    const total = hh * 60 + mm + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  async function prefillStartTime() {
    if (!qaeStartInput) return;
    try {
      const todayData = await loadTodayEntries();
      const lastEntry = todayData.find((item) => item.type === "time_entry");
      qaeStartInput.value = lastEntry?.data?.ended_at
        ? addMinutes(toTimeValue(lastEntry.data.ended_at), 1)
        : nowTimeValue();
    } catch {
      qaeStartInput.value = nowTimeValue();
    }
    if (qaeEndInput) {
      qaeEndInput.value = addMinutes(qaeStartInput.value, 10);
    }
  }

  void prefillStartTime();

  function qaeShowError(msg) {
    if (!qaeError) return;
    qaeError.textContent = msg;
    qaeError.classList.remove("hidden");
    setTimeout(() => qaeError.classList.add("hidden"), 3000);
  }

  qaeAddBtn?.addEventListener("click", async () => {
    const title = qaeTaskInput?.value.trim();
    const startVal = qaeStartInput?.value;
    const endVal = qaeEndInput?.value;

    if (!title) { qaeShowError("Task name is required."); return; }
    if (!startVal) { qaeShowError("Start time is required."); return; }
    if (!endVal) { qaeShowError("End time is required."); return; }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const startedAt = new Date(`${today}T${startVal}`);
    const endedAt = new Date(`${today}T${endVal}`);

    if (endedAt <= startedAt) {
      qaeShowError("End time must be after start time.");
      return;
    }

    qaeAddBtn.disabled = true;
    try {
      await manualEntryController.addManualEntry({
        taskTitle: title,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });
      qaeTaskInput.value = "";
      qaeEndInput.value = "";
      void prefillStartTime();
    } catch (err) {
      qaeShowError(err.message || "Failed to add entry.");
    } finally {
      qaeAddBtn.disabled = false;
    }
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
