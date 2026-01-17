// Centralized semantic IDs; change here if HTML IDs change.

const base = {
  clock: "timer-clock",
  status: "timer-status",
  startBtn: "start-btn",
  pauseBtn: "pause-btn",
  resumeBtn: "resume-btn",
  stopBtn: "stop-btn",
  cancelBtn: "cancel-btn",
};

const timerIds = {
  // Timer Control buttons
  ...base,

  // Segment controls
  segmentControls: "segment-controls",
  nameSegmentBtn: "name-segment-btn",
  logBreakBtn: "log-break-btn",
  newSegmentBtn: "new-segment-btn",
  splitEntryBtn: "split-entry-btn",
  timerMenuTrigger: "timer-menu-trigger",
  timerMenuDropdown: "timer-menu-dropdown",
};

const modalTimerIds = {
  clock: `${base.clock}-modal`,
  status: `${base.status}-modal`,
  startBtn: `${base.startBtn}-modal`,
  pauseBtn: `${base.pauseBtn}-modal`,
  resumeBtn: `${base.resumeBtn}-modal`,
  stopBtn: `${base.stopBtn}-modal`,
  cancelBtn: `${base.cancelBtn}-modal`,
};

export { timerIds, modalTimerIds };
