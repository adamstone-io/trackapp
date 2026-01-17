// state/timer.js

/**
 * Timer manages elapsed time for a single timing session.
 * Create multiple instances for independent timers.
 */
export class Timer {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.startTimeMs = null;
    this.pauseStartTimeMs = null;
    this.elapsedSeconds = 0;
    this._tickId = null;
    this._subs = new Set();
  }

  _notify() {
    const snapshot = this.getSnapshot();
    this._subs.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error("Timer subscriber error:", err);
      }
    });
  }

  _startTick() {
    this._stopTick();
    if (this.isRunning && !this.isPaused) {
      this._tickId = setInterval(() => this._notify(), 1000);
      this._notify();
    }
  }

  _stopTick() {
    if (this._tickId) {
      clearInterval(this._tickId);
      this._tickId = null;
    }
  }

  getElapsedSeconds(now = Date.now()) {
    if (!this.isRunning || this.isPaused || this.startTimeMs === null) {
      return this.elapsedSeconds;
    }
    return this.elapsedSeconds + Math.floor((now - this.startTimeMs) / 1000);
  }

  start(now = Date.now()) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startTimeMs = now;
    this.pauseStartTimeMs = null;
    this.elapsedSeconds = 0;
    this._startTick();
  }

  pause(now = Date.now()) {
    if (!this.isRunning || this.isPaused) return;
    if (this.startTimeMs !== null) {
      this.elapsedSeconds += Math.floor((now - this.startTimeMs) / 1000);
    }
    this.isPaused = true;
    this.pauseStartTimeMs = now;
    this.startTimeMs = null;
    this._stopTick();
    this._notify();
  }

  resume(now = Date.now()) {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.startTimeMs = now;
    this.pauseStartTimeMs = null;
    this._startTick();
  }

  stop(now = Date.now()) {
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
    this._notify();
  }

  getSnapshot(now = Date.now()) {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      startTimeMs: this.startTimeMs,
      pauseStartTimeMs: this.pauseStartTimeMs,
      elapsedSeconds: this.getElapsedSeconds(now),
    };
  }

  subscribe(fn) {
    if (typeof fn === "function") {
      this._subs.add(fn);
      fn(this.getSnapshot());
    }
    return () => this._subs.delete(fn);
  }
}
