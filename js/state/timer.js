// state/timer.js
import { nowMs } from "../utils/time.js";

export class Timer {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;

    this.startTimeMs = null; // set on start/resume (anchor of current run)
    this.pauseStartTimeMs = null; // set on pause
    this.elapsedSeconds = 0; // accumulated run time (excludes paused time)

    this._tickId = null; // setInterval handle
    this._subs = new Set(); // subscribers: (snapshot) => void

    this.taskTitle = "";
  }

  // Public read: current elapsed seconds
  getElapsedSeconds(now = nowMs()) {
    if (!this.isRunning || this.isPaused || this.startTimeMs === null) {
      return this.elapsedSeconds;
    }
    const sinceStart = Math.floor((now - this.startTimeMs) / 1000);
    return this.elapsedSeconds + sinceStart;
  }

  // Public read: consistent snapshot for rendering
  snapshot(now = nowMs()) {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      startTimeMs: this.startTimeMs,
      pauseStartTimeMs: this.pauseStartTimeMs,
      elapsedSeconds: this.getElapsedSeconds(now),
      taskTitle: this.taskTitle,
    };
  }

  // Subscribe to updates; returns an unsubscribe function
  subscribe(fn) {
    if (typeof fn === "function") {
      this._subs.add(fn);
      fn(this.snapshot()); // immediate first call
    }
    return () => this._subs.delete(fn);
  }

  // Internal: notify subscribers
  _emit() {
    const snap = this.snapshot();
    this._subs.forEach((fn) => {
      try {
        fn(snap);
      } catch {}
    });
  }

  // Internal: tick management
  _startTick() {
    this._stopTick();
    if (this.isRunning && !this.isPaused) {
      this._tickId = setInterval(() => this._emit(), 1000);
      this._emit(); // immediate
    }
  }
  _stopTick() {
    if (this._tickId) {
      clearInterval(this._tickId);
      this._tickId = null;
    }
  }

  // Transitions
  start(now = nowMs()) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startTimeMs = now;
    this.pauseStartTimeMs = null;
    this.elapsedSeconds = 0;
    this._startTick();
  }

  pause(now = nowMs()) {
    if (!this.isRunning || this.isPaused) return;
    if (this.startTimeMs !== null) {
      const sinceStart = Math.floor((now - this.startTimeMs) / 1000);
      this.elapsedSeconds += sinceStart; // accumulate up to pause
    }
    this.isPaused = true;
    this.pauseStartTimeMs = now;
    this.startTimeMs = null;
    this._stopTick();
    this._emit();
  }

  resume(now = nowMs()) {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.startTimeMs = now; // anchor a new running stretch
    this.pauseStartTimeMs = null;
    this._startTick();
  }

  stop(now = nowMs()) {
    if (!this.isRunning) return 0;
    const total = this.getElapsedSeconds(now);
    this.reset();
    return total;
  }

  reset() {
    this.isRunning = false;
    this.isPaused = false;
    this.startTimeMs = null;
    this.pauseStartTimeMs = null;
    this.elapsedSeconds = 0;
    this._stopTick();
    this._emit();
  }

  cancel() {
    // Discard elapsed time and stop
    this.reset();
  }
}
