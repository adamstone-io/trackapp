// controllers/timer-controller.js
import { Timer } from "../state/timer.js"; // ✅ import class
import * as currentTask from "../state/current-task.js";
import { Task } from "../domain/task.js";
import { TimeEntry } from "../domain/time-entry.js";
import { TimerView } from "../views/timer-view.js";
import { CurrentTaskView } from "../views/current-task-view.js";
import { EntriesView } from "../views/list-entries-view.js";
import { formatTime } from "../utils/time.js";
import { saveTimeEntries, loadTimeEntries } from "../data/storage.js";
import { createBreakModal } from "../views/components/break-modal.js";
import { SoundManager } from "../utils/sound-manager.js";

let activeEntry = null;
let timeEntries = [];
let pauseStartMs = null;
let pauseTickerId = null;

export function createTimerController({ onEntryAdded }) {
  // Load existing time entries from storage
  timeEntries = loadTimeEntries();

  const timer = new Timer(); // ✅ create instance
  const breakModal = createBreakModal({
    onSave: ({ label }) => {
      if (!timer.getSnapshot().isPaused) return;
      finalizePause({ label, createEntry: true });
      clearPauseTracking();
      timer.resume();
    },
  });

  // Countdown state
  let countdownMode = false;
  let targetDuration = 0;
  const countdownModeBtn = document.getElementById("mode-countdown-btn");

  const isCountdownUiActive = () => {
    if (!countdownModeBtn) return countdownMode;
    return countdownModeBtn.classList.contains("mode-btn--active");
  };

  // Subscribe to timer state
  const renderSnapshot = (snapshot) => {
    let displayTime = snapshot.elapsedSeconds;

    const isCountdownActive = () =>
      countdownModeBtn?.classList.contains("mode-btn--active");

    if (isCountdownActive() && targetDuration > 0) {
      if (snapshot.isRunning) {
        const remaining = targetDuration - snapshot.elapsedSeconds;
        displayTime = Math.max(0, remaining);
        if (remaining <= 0) {
          handleStop("countdown-zero");
          return;
        }
      } else {
        displayTime = targetDuration;
      }
    }

    if (snapshot.isPaused && pauseStartMs === null) {
      pauseStartMs = snapshot.pauseStartTimeMs ?? null;
    }

    const pauseDurationSeconds = snapshot.isPaused
      ? getPauseDurationSeconds(snapshot)
      : 0;

    TimerView.render({
      time: formatTime(displayTime),
      running: snapshot.isRunning,
      paused: snapshot.isPaused,
      pauseDurationLabel: snapshot.isPaused
        ? formatTime(pauseDurationSeconds)
        : "",
    });
  };

  const unsubTimer = timer.subscribe((snapshot) => {
    renderSnapshot(snapshot);
  });

  // Subscribe to current task state
  const unsubTask = currentTask.subscribe((taskState) => {
    CurrentTaskView.render({
      taskTitle: taskState.title,
      running: timer.getSnapshot().isRunning,
    });
  });

  // Listen for countdown mode changes
  const handleModeChange = (event) => {
    countdownMode = event.detail.mode === "countdown";
    targetDuration = event.detail.targetDuration || 0;
    if (!countdownMode) {
      timer.reset();
      currentTask.clearCurrentTask();
      CurrentTaskView.clearInputs();
      activeEntry = null;
    }
    renderSnapshot(timer.getSnapshot());
  };

  // Listen for countdown duration changes
  const handleDurationChange = (event) => {
    targetDuration = event.detail.duration || 0;
    renderSnapshot(timer.getSnapshot());
  };

  document.addEventListener("timer:modeChange", handleModeChange);
  document.addEventListener("countdown:durationChange", handleDurationChange);

  // Bind timer controls
  const unbind = TimerView.bind({
    onStart: handleStart,
    onPause: handlePause,
    onResume: handleResume,
    onLogBreak: handleLogBreak,
    onStop: handleStop,
    onCancel: handleCancel,
  });

  function handlePause() {
    if (!timer.getSnapshot().isRunning || timer.getSnapshot().isPaused) return;
    timer.pause();
    pauseStartMs = timer.getSnapshot().pauseStartTimeMs ?? Date.now();
    startPauseTicker();
  }

  function handleResume() {
    if (!timer.getSnapshot().isPaused) return;
    finalizePause({ label: "Pause", createEntry: false });
    clearPauseTracking();
    timer.resume();
  }

  function handleLogBreak() {
    if (!timer.getSnapshot().isPaused) return;
    breakModal.open();
  }

  function handleCancel() {
    clearPauseTracking();
    timer.stop();
    
    currentTask.clearCurrentTask();
    CurrentTaskView.clearInputs();
    activeEntry = null;

    // Update view to make inputs editable again
    CurrentTaskView.render({
      taskTitle: "",
      running: false,
    });

    // Show countdown favorites when timer is cancelled
    if (isCountdownUiActive()) {
      showCountdownFavorites();
    }
  }

  function handleStart() {
    const taskData = CurrentTaskView.readTask();

    const task = new Task(taskData);

    currentTask.setCurrentTask(task);
    clearPauseTracking();
    timer.start();
    if (!isCountdownUiActive()) {
      countdownMode = false;
      targetDuration = 0;
    }

    // Hide countdown favorites when timer starts
    if (isCountdownUiActive()) {
      hideCountdownFavorites();
    }

    // Update view to make inputs readonly
    CurrentTaskView.render({
      taskTitle: task.title,
      running: true,
    });

    activeEntry = new TimeEntry({
      taskId: task.id,
      taskTitle: task.title,
      startedAt: new Date().toISOString(),
    });
  }

  function handleStop(reason = "manual") {
    // Finalize any active pause before stopping
    if (timer.getSnapshot().isPaused && pauseStartMs) {
      finalizePause({ label: "Pause", createEntry: false });
    }
    
    clearPauseTracking();
    const duration = timer.stop();

    if (reason === "countdown-zero") {
      SoundManager.play("timerFinished");
    }

    activeEntry.finalize({
      endedAt: new Date().toISOString(),
      durationSeconds: duration,
    });

    // Add the completed entry to our collection and save to storage
    timeEntries.push(activeEntry);
    saveTimeEntries(timeEntries);

    if (typeof onEntryAdded === "function") {
      onEntryAdded(activeEntry);
    }
    currentTask.clearCurrentTask();
    CurrentTaskView.clearInputs();
    activeEntry = null;

    // Update view to make inputs editable again
    CurrentTaskView.render({
      taskTitle: "",
      running: false,
    });

    // Show countdown favorites when timer stops
    if (isCountdownUiActive()) {
      showCountdownFavorites();
    }
  }

  function getPauseDurationSeconds(snapshot, now = Date.now()) {
    const startMs =
      pauseStartMs ?? snapshot?.pauseStartTimeMs ?? null;
    if (!startMs) return 0;
    return Math.max(0, Math.floor((now - startMs) / 1000));
  }

  function finalizePause({ label, createEntry }) {
    if (!activeEntry || !pauseStartMs) return;

    const startedAt = new Date(pauseStartMs).toISOString();
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((Date.parse(endedAt) - pauseStartMs) / 1000),
    );

    let loggedEntryId = null;
    if (createEntry) {
      const breakTask = new Task({
        title: label,
        category: "",
      });
      const breakEntry = new TimeEntry({
        taskId: breakTask.id,
        taskTitle: breakTask.title,
        startedAt,
        endedAt,
        durationSeconds,
      });
      loggedEntryId = breakEntry.id;
      timeEntries.push(breakEntry);
      saveTimeEntries(timeEntries);
      if (typeof onEntryAdded === "function") {
        onEntryAdded(breakEntry);
      }
    }

    activeEntry.addBreak({
      id: crypto.randomUUID(),
      startedAt,
      endedAt,
      durationSeconds,
      label,
      loggedEntryId,
    });
  }

  function startPauseTicker() {
    stopPauseTicker();
    pauseTickerId = setInterval(() => {
      renderSnapshot(timer.getSnapshot());
    }, 1000);
    renderSnapshot(timer.getSnapshot());
  }

  function stopPauseTicker() {
    if (pauseTickerId) {
      clearInterval(pauseTickerId);
      pauseTickerId = null;
    }
  }

  function clearPauseTracking() {
    pauseStartMs = null;
    stopPauseTicker();
  }

  function hideCountdownFavorites() {
    const addFavoriteBtn = document.getElementById("add-favorite-btn");
    const favoritesList = document.getElementById("favorites-list");
    
    if (addFavoriteBtn) {
      addFavoriteBtn.classList.add("hidden");
    }
    if (favoritesList) {
      favoritesList.classList.add("hidden");
    }
  }

  function showCountdownFavorites() {
    const addFavoriteBtn = document.getElementById("add-favorite-btn");
    const favoritesList = document.getElementById("favorites-list");
    
    if (addFavoriteBtn) {
      addFavoriteBtn.classList.remove("hidden");
    }
    if (favoritesList) {
      favoritesList.classList.remove("hidden");
    }
  }

  /**
   * Refresh the today's entries list.
   */
  function refreshEntriesList() {
    const entries = loadTimeEntries();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.startedAt);
      return entryDate >= today && entryDate < tomorrow;
    });

    EntriesView.render(todayEntries);
  }

  return () => {
    unbind();
    unsubTimer();
    unsubTask();
    document.removeEventListener("timer:modeChange", handleModeChange);
    document.removeEventListener(
      "countdown:durationChange",
      handleDurationChange,
    );
  };
}
