import { byId, on, show, hide, toggle } from "../ui/ui-core.js";
import { ids } from "../ui/ids.js";

const noop = () => {};

export const TimerView = {
  title: () => byId(ids.currentTaskTitle),
  clock: () => byId(ids.timerClock),
  inputSection: () => byId(ids.taskInputSection),
  start: () => byId(ids.startBtn),
  pause: () => byId(ids.pauseBtn),
  resume: () => byId(ids.resumeBtn),
  logBreak: () => byId(ids.logBreakBtn),
  stop: () => byId(ids.stopBtn),
  cancel: () => byId(ids.cancelBtn),
  logMoment: () => byId(ids.logMomentBtn),
  segmentControls: () => byId(ids.segmentControls),

  render({ time, running, paused, taskTitle }) {
    const title = this.title();
    const clock = this.clock();
    const input = this.inputSection();
    const start = this.start();
    const pauseBtn = this.pause();
    const resumeBtn = this.resume();
    const logBreak = this.logBreak();
    const stopBtn = this.stop();
    const cancelBtn = this.cancel();
    const logMoment = this.logMoment();
    const segments = this.segmentControls();

    clock.textContent = time;
    title.textContent = taskTitle || "Ready to track time";

    if (!running) {
      show(start);
      hide(pauseBtn);
      hide(resumeBtn);
      hide(logBreak);
      hide(stopBtn);
      hide(cancelBtn);
      show(logMoment);
      show(input);
      hide(segments);
    } else {
      hide(start);
      show(stopBtn);
      show(cancelBtn);
      hide(logMoment);
      hide(input);
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
      onStart = noop,
      onPause = noop,
      onResume = noop,
      onStop = noop,
      onCancel = noop,
      onLogMoment = noop,
    } = handlers || {};

    const unbinds = [
      on(this.start(), "click", onStart),
      on(this.pause(), "click", onPause),
      on(this.resume(), "click", onResume),
      on(this.stop(), "click", onStop),
      on(this.cancel(), "click", onCancel),
      on(this.logMoment(), "click", onLogMoment),
    ];
    return () => unbinds.forEach((u) => u());
  },
};
