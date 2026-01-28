// state/current-task.js

/**
 * Manages the currently selected/active task.
 * 
 * This is application state (not a domain class) that tracks which Task
 * is currently being worked on. Multiple controllers can use this state
 * (e.g., timer controller, task list, planner).
 */

let currentTask = null;
const subscribers = new Set();

function notify() {
  const snapshot = getSnapshot();
  subscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      console.error("Subscriber error:", err);
    }
  });
}

/**
 * Set the active task.
 */
export function setCurrentTask(task) {
  currentTask = task;
  notify();
}

/**
 * Clear the active task.
 */
export function clearCurrentTask() {
  currentTask = null;
  notify();
}

/**
 * Get the current task reference directly (use sparingly).
 */
export function getCurrentTask() {
  return currentTask;
}

/**
 * Get a snapshot of current task state for rendering.
 */
export function getSnapshot() {
  return {
    task: currentTask,
    hasTask: currentTask !== null,
    title: currentTask?.title || "",
    category: currentTask?.category || null,
  };
}

/**
 * Subscribe to current task changes.
 * Returns an unsubscribe function.
 */
export function subscribe(fn) {
  if (typeof fn === "function") {
    subscribers.add(fn);
    fn(getSnapshot()); // immediate call with current state
  }
  return () => subscribers.delete(fn);
}
