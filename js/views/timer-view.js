import { byId, on, show, hide, toggle } from "../ui/ui-core.js";
import { timerIds } from "../ui/timer-ids.js";

const noOperation = () => {};

export const TimerView = {
  clock: () => byId(timerIds.clock),
  start: () => byId(timerIds.startBtn),
  pause: () => byId(timerIds.pauseBtn),
  resume: () => byId(timerIds.resumeBtn),
  logBreak: () => byId(timerIds.logBreakBtn),
  stop: () => byId(timerIds.stopBtn),
  cancel: () => byId(timerIds.cancelBtn),
  segmentControls: () => byId(timerIds.segmentControls),

  render({ time, running, paused, taskTitle }) {
    const clock = this.clock();
    const start = this.start();
    const pauseBtn = this.pause();
    const resumeBtn = this.resume();
    const logBreak = this.logBreak();
    const stopBtn = this.stop();
    const cancelBtn = this.cancel();
    const segments = this.segmentControls();

    clock.textContent = time;

    if (!running) {
      show(start);
      hide(pauseBtn);
      hide(resumeBtn);
      hide(logBreak);
      hide(stopBtn);
      hide(cancelBtn);
      hide(segments);
    } else {
      hide(start);
      show(stopBtn);
      show(cancelBtn);
      show(segments);
      if (paused) {
        hide(pauseBtn);
        show(resumeBtn);
        show(logBreak);
      } else {
        show(pauseBtn);
        hide(resumeBtn);
        hide(logBreak);
      }
    }
  },

  bind(handlers) {
    const {
      onStart = noOperation,
      onPause = noOperation,
      onResume = noOperation,
      onStop = noOperation,
      onCancel = noOperation,
    } = handlers || {};

    const unbinds = [
      on(this.start(), "click", onStart),
      on(this.pause(), "click", onPause),
      on(this.resume(), "click", onResume),
      on(this.stop(), "click", onStop),
      on(this.cancel(), "click", onCancel),
    ];
    return () => unbinds.forEach((u) => u());
  },
};
