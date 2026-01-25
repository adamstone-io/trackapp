import { byId, on, show, hide, toggle } from "../ui/ui-core.js";
import { momentIds } from "../ui/moment-ids.js";
import { timerIds } from "../ui/timer-ids.js";

const noOperation = () => {};

export const TimerView = {
  clock: () => byId(timerIds.clock),
  pauseDisplay: () => byId(timerIds.pauseDisplay),
  start: () => byId(timerIds.startBtn),
  pause: () => byId(timerIds.pauseBtn),
  resume: () => byId(timerIds.resumeBtn),
  logBreak: () => byId(timerIds.logBreakBtn),
  save: () => byId(timerIds.saveBtn),
  cancel: () => byId(timerIds.cancelBtn),
  segmentControls: () => byId(timerIds.segmentControls),
  logMoment: () => byId(momentIds.logMomentBtn),

  render({ time, running, paused, pauseDurationLabel }) {
    const clock = this.clock();
    const clockDisplay = clock?.querySelector("#timer-clock-display");
    const hoursDisplay = clockDisplay?.querySelector(
      '[data-clock-part="hours"]',
    );
    const minutesDisplay = clockDisplay?.querySelector(
      '[data-clock-part="minutes"]',
    );
    const secondsDisplay = clockDisplay?.querySelector(
      '[data-clock-part="seconds"]',
    );
    const start = this.start();
    const pauseBtn = this.pause();
    const resumeBtn = this.resume();
    const logBreak = this.logBreak();
    const saveBtn = this.save();
    const cancelBtn = this.cancel();
    const segments = this.segmentControls();
    const logMoment = this.logMoment();
    const pauseDisplay = this.pauseDisplay();

    if (clockDisplay && hoursDisplay && minutesDisplay && secondsDisplay) {
      const [hours = "00", minutes = "00", seconds = "00"] = String(time).split(
        ":",
      );
      hoursDisplay.textContent = hours;
      minutesDisplay.textContent = minutes;
      secondsDisplay.textContent = seconds;
    } else if (clock) {
      clock.textContent = time;
    }

    if (!running) {
      show(start);
      show(logMoment);
      hide(pauseBtn);
      hide(resumeBtn);
      hide(logBreak);
      hide(saveBtn);
      hide(cancelBtn);
      hide(segments);
      if (pauseDisplay) {
        hide(pauseDisplay);
        pauseDisplay.textContent = "";
      }
    } else {
      hide(start);
      hide(logMoment);
      show(saveBtn);
      show(cancelBtn);
      show(segments);
      if (paused) {
        hide(pauseBtn);
        show(resumeBtn);
        show(logBreak);
        if (pauseDisplay) {
          pauseDisplay.textContent = pauseDurationLabel
            ? `Paused ${pauseDurationLabel}`
            : "Paused";
          show(pauseDisplay);
        }
      } else {
        show(pauseBtn);
        hide(resumeBtn);
        hide(logBreak);
        if (pauseDisplay) {
          hide(pauseDisplay);
          pauseDisplay.textContent = "";
        }
      }
    }
  },

  bind(handlers) {
    const {
      onStart = noOperation,
      onPause = noOperation,
      onResume = noOperation,
      onLogBreak = noOperation,
      onSave = noOperation,
      onCancel = noOperation,
    } = handlers || {};

    const unbinds = [
      on(this.start(), "click", onStart),
      on(this.pause(), "click", onPause),
      on(this.resume(), "click", onResume),
      on(this.logBreak(), "click", onLogBreak),
      on(this.save(), "click", onSave),
      on(this.cancel(), "click", onCancel),
    ];
    return () => unbinds.forEach((u) => u());
  },
};
