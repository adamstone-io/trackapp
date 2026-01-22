// controllers/timer-controller.js
import { Timer } from "../state/timer.js";  // ✅ import class
import * as currentTask from "../state/current-task.js";
import { Task } from "../domain/task.js";
import { TimeEntry } from "../domain/time-entry.js";
import { TimerView } from "../views/timer-view.js";
import { CurrentTaskView } from "../views/current-task-view.js";
import { EntriesView } from "../views/list-entries-view.js";
import { formatTime } from "../utils/time.js";
import { saveTimeEntries, loadTimeEntries } from "../data/storage.js";

let activeEntry = null;
let timeEntries = [];

export function createTimerController({ onEntryAdded }) {
  // Load existing time entries from storage
  timeEntries = loadTimeEntries();

  const timer = new Timer();  // ✅ create instance

  // Countdown state
  let countdownMode = false;
  let targetDuration = 0;

  // Subscribe to timer state
  const unsubTimer = timer.subscribe((snapshot) => {
    let displayTime = snapshot.elapsedSeconds;

    // In countdown mode, show remaining time instead of elapsed time
    if (countdownMode && targetDuration > 0) {
      displayTime = Math.max(0, targetDuration - snapshot.elapsedSeconds);

      // Auto-stop when countdown reaches zero
      if (snapshot.elapsedSeconds >= targetDuration && snapshot.isRunning) {
        handleStop();
        return;
      }
    }

    TimerView.render({
      time: formatTime(displayTime),
      running: snapshot.isRunning,
      paused: snapshot.isPaused,
    });
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
  };

  // Listen for countdown duration changes
  const handleDurationChange = (event) => {
    targetDuration = event.detail.duration || 0;
  };

  document.addEventListener("timer:modeChange", handleModeChange);
  document.addEventListener("countdown:durationChange", handleDurationChange);

  // Bind timer controls
  const unbind = TimerView.bind({
    onStart: handleStart,
    onPause: () => timer.pause(),
    onResume: () => timer.resume(),
    onStop: handleStop,
  });

  function handleStart() {
    const taskData = CurrentTaskView.readTask();
    
    const task = new Task(taskData);
    
    currentTask.setCurrentTask(task);
    timer.start();
    
    activeEntry = new TimeEntry({
      taskId: task.id,
      taskTitle: task.title,
      startedAt: new Date().toISOString(),
    });
  }

  function handleStop() {
    const duration = timer.stop();

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
    activeEntry = null;
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
    document.removeEventListener("countdown:durationChange", handleDurationChange);
  };
}
