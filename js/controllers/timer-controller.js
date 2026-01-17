// controllers/timer-controller.js
import { Timer } from "../state/timer.js";  // ✅ import class
import * as currentTask from "../state/current-task.js";
import { Task } from "../domain/task.js";
import { TimeEntry } from "../domain/time-entry.js";
import { TimerView } from "../views/timer-view.js";
import { CurrentTaskView } from "../views/current-task-view.js";
import { formatTime } from "../utils/time.js";
import { saveTimeEntries, loadTimeEntries } from "../data/storage.js";

let activeEntry = null;
let timeEntries = [];

export function createTimerController() {
  // Load existing time entries from storage
  timeEntries = loadTimeEntries();

  const timer = new Timer();  // ✅ create instance

  // Subscribe to timer state
  const unsubTimer = timer.subscribe((snapshot) => {
    TimerView.render({
      time: formatTime(snapshot.elapsedSeconds),
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

    console.log("Entry completed and saved:", activeEntry);

    currentTask.clearCurrentTask();
    activeEntry = null;
  }

  return () => {
    unbind();
    unsubTimer();
    unsubTask();
  };
}
