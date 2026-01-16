// controllers/timer-controller.js
import { Timer } from "../state/timer.js";
import { TimerView } from "../views/timer-view.js";
import { formatTime } from "../utils/time.js";

export function createTimer() {
  // Initializes the timer system (model + view wiring) and returns a small control API.

  // Creates a Timer (state/logic)
  // Subscribes to updates and renders via TimerView
  // Binds UI events to timer methods
  // Exposes { setTaskTitle, dispose, getTimer }

  const timer = new Timer();

  const unsubscribe = timer.subscribe((s) => {
    TimerView.render({
      time: formatTime(s.elapsedSeconds),
      running: s.isRunning,
      paused: s.isPaused,
      taskTitle: s.taskTitle,
    });
  });

  const unbind = TimerView.bind({
    onStart: () => timer.start(),
    onPause: () => timer.pause(),
    onResume: () => timer.resume(),
    onStop: () => {
      const total = timer.stop(); /* persist total if needed */
    },
    onCancel: () => timer.cancel(),
    onLogMoment: () => {
      /* show dialog */
    },
  });

  return {
    setTaskTitle(title) {
      timer.taskTitle = title || "";
    },
    dispose() {
      unbind();
      unsubscribe();
      timer.reset();
    },
    getTimer() {
      return timer;
    },
  };
}
