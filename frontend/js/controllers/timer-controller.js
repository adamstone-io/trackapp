// controllers/timer-controller.js
import { Timer } from "../state/timer.js"; // ✅ import class
import * as currentTask from "../state/current-task.js";
import { Task } from "../domain/task.js";
import { TimeEntry } from "../domain/time-entry.js";
import { TimerView } from "../views/timer-view.js";
import { CurrentTaskView } from "../views/current-task-view.js";
import { EntriesView } from "../views/list-entries-view.js";
import { formatTime } from "../utils/time.js";
import {
  loadTasks,
  loadTimeEntries,
  createTask,
  createTimeEntry,
} from "../data/storage.js";
import { createBreakModal } from "../views/components/break-modal.js";
import { SoundManager } from "../utils/sound-manager.js";

let activeEntry = null;
let activeTask = null;
let timeEntries = [];
let pauseStartMs = null;
let pauseTickerId = null;
let isStarting = false; // Guard against double-clicks

export function createTimerController({ onEntryAdded }) {
  const timer = new Timer(); // ✅ create instance
  const breakModal = createBreakModal({
    onSave: async ({ label }) => {
      if (!timer.getSnapshot().isPaused) return;
      await finalizePause({ label, createEntry: true });
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

  async function handleResume() {
    if (!timer.getSnapshot().isPaused) return;
    await finalizePause({ label: "Pause", createEntry: false });
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
    activeTask = null;

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

  async function handleStart() {
    // Prevent double-clicks while async operations are in progress
    if (isStarting || timer.getSnapshot().isRunning) {
      return;
    }
    isStarting = true;

    try {
      const taskData = CurrentTaskView.readTask();

      // Use default title if empty (API requires non-blank title)
      if (!taskData.title || !taskData.title.trim()) {
        taskData.title = "Untitled";
      }

      const task = new Task(taskData);

      currentTask.setCurrentTask(task);
      clearPauseTracking();
      timer.start();

      if (!isCountdownUiActive()) {
        countdownMode = false;
        targetDuration = 0;
      }

      if (isCountdownUiActive()) {
        hideCountdownFavorites();
      }

      CurrentTaskView.render({
        taskTitle: task.title,
        running: true,
      });

      activeTask = task;
      activeEntry = new TimeEntry({
        taskId: task.id,
        taskTitle: task.title,
        startedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to start timer:", err);

      clearPauseTracking();
      timer.reset();
      currentTask.clearCurrentTask();
      CurrentTaskView.clearInputs();
      activeEntry = null;
      activeTask = null;

      CurrentTaskView.render({
        taskTitle: "",
        running: false,
      });
    } finally {
      isStarting = false;
    }
  }

  async function ensureTaskExists(task) {
    if (!task) return null;
    const existingTasks = await loadTasks();
    const normalizedTitle = task.title.trim().toLowerCase();
    const normalizedCategory = task.category?.trim().toLowerCase() || "";
    const normalizedProjectId = task.projectId ?? null;

    const byId = existingTasks.find((t) => t.id === task.id);
    if (byId) return byId.id;

    const byMatch = existingTasks.find((t) => {
      const title = String(t.title || "")
        .trim()
        .toLowerCase();
      const category = String(t.category || "")
        .trim()
        .toLowerCase();
      const projectId = t.projectId ?? t.project ?? null;
      return (
        title === normalizedTitle &&
        category === normalizedCategory &&
        projectId === normalizedProjectId
      );
    });
    if (byMatch) return byMatch.id;

    const payload = {
      ...task.toJSON(),
      project: task.projectId ?? null, // FK
    };
    delete payload.projectId;
    const saved = await createTask(payload);
    return saved?.id ?? task.id;
  }

  async function handleStop(reason = "manual") {
    if (timer.getSnapshot().isPaused && pauseStartMs) {
      await finalizePause({ label: "Pause", createEntry: false });
    }

    clearPauseTracking();
    const duration = timer.stop();

    if (reason === "countdown-zero") {
      SoundManager.play("timerFinished");
    }

    if (!activeEntry || !activeTask) {
      currentTask.clearCurrentTask();
      CurrentTaskView.clearInputs();
      activeEntry = null;
      activeTask = null;
      CurrentTaskView.render({ taskTitle: "", running: false });
      if (isCountdownUiActive()) showCountdownFavorites();
      return;
    }

    try {
      const ensuredTaskId = await ensureTaskExists(activeTask);
      if (ensuredTaskId) {
        activeEntry.taskId = ensuredTaskId;
      }

      activeEntry.finalize({
        endedAt: new Date().toISOString(),
        durationSeconds: duration,
      });

      const payload = {
        task: activeEntry.taskId,
        taskTitle: activeEntry.taskTitle,
        startedAt: activeEntry.startedAt,
        endedAt: activeEntry.endedAt,
        durationSeconds: activeEntry.durationSeconds,
        notes: activeEntry.notes,
        breaks: activeEntry.breaks,
      };
      const savedEntry = await createTimeEntry(payload);

      if (typeof onEntryAdded === "function") {
        onEntryAdded(savedEntry);
      }
    } catch (err) {
      console.error("Failed to save time entry to API:", err);
      alert(
        `Could not save time entry: ${err.message || "Network or server error"}. Check console and that the backend is running at ${"http://127.0.0.1:8000"}.`,
      );
      return;
    }

    currentTask.clearCurrentTask();
    CurrentTaskView.clearInputs();
    activeEntry = null;
    activeTask = null;

    CurrentTaskView.render({
      taskTitle: "",
      running: false,
    });

    if (isCountdownUiActive()) {
      showCountdownFavorites();
    }
  }

  function getPauseDurationSeconds(snapshot, now = Date.now()) {
    const startMs = pauseStartMs ?? snapshot?.pauseStartTimeMs ?? null;
    if (!startMs) return 0;
    return Math.max(0, Math.floor((now - startMs) / 1000));
  }

  async function finalizePause({ label, createEntry }) {
    if (!activeEntry || !pauseStartMs) return;

    const startedAt = new Date(pauseStartMs).toISOString();
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((Date.parse(endedAt) - pauseStartMs) / 1000),
    );

    let loggedEntryId = null;
    if (createEntry) {
      try {
        const breakTask = new Task({
          title: label,
          category: "",
        });

        const taskPayload = {
          ...breakTask.toJSON(),
          project: breakTask.projectId ?? null,
        };
        delete taskPayload.projectId;

        const savedTask = await createTask(taskPayload);

        const breakEntryPayload = {
          task: savedTask.id,
          taskTitle: breakTask.title,
          startedAt,
          endedAt,
          durationSeconds,
          notes: "",
          breaks: [],
        };

        const savedEntry = await createTimeEntry(breakEntryPayload);
        loggedEntryId = savedEntry.id;

        if (typeof onEntryAdded === "function") {
          onEntryAdded(savedEntry);
        }
      } catch (err) {
        console.error("Failed to save break entry to API:", err);
        alert(
          `Could not save break: ${err.message || "Network or server error"}.`,
        );
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
  async function refreshEntriesList() {
    const entries = await loadTimeEntries();
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
