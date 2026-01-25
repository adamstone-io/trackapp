/**
 * TimeEntry represents a completed or in-progress work session.
 * Each entry is linked to a task and records when work was performed.
 * Task title is snapshotted for historical accuracy.
 */
export class TimeEntry {
    /**
     * @param {Object} data
     * @param {string} [data.id] - Unique identifier (generated if not provided)
     * @param {string} data.taskId - Reference to the task
     * @param {string} data.taskTitle - Snapshot of task title at time of creation
     * @param {string} data.startedAt - ISO date string for start time
     * @param {string} [data.endedAt] - ISO date string for end time (null if active)
     * @param {number} [data.durationSeconds] - Total duration in seconds (0 if active)
     * @param {string} [data.notes] - Optional notes for this specific session
     */
    constructor({
      id,
      taskId,
      taskTitle = "",
      startedAt,
      endedAt = null,
      durationSeconds = 0,
      notes = "",
      breaks = [],
    }) {
      if (!taskId) {
        throw new Error("TimeEntry requires a taskId");
      }
      if (!startedAt) {
        throw new Error("TimeEntry requires a startedAt timestamp");
      }
  
      this.id = id ?? crypto.randomUUID();
      this.taskId = taskId;
      this.taskTitle = taskTitle.trim();
      this.startedAt = startedAt;
      this.endedAt = endedAt;
      this.durationSeconds = durationSeconds;
      this.notes = notes;
      this.breaks = Array.isArray(breaks) ? breaks : [];
      this.createdAt = new Date().toISOString();
    }
  
    /**
     * Check if this entry is currently active (not finalized).
     */
    get isActive() {
      return this.endedAt === null;
    }
  
    /**
     * Finalize an active entry with end time and duration.
     * @param {Object} data
     * @param {string} data.endedAt - ISO date string for end time
     * @param {number} data.durationSeconds - Total duration in seconds
     */
    finalize({ endedAt, durationSeconds }) {
      if (!this.isActive) {
        throw new Error("Cannot finalize an already finalized TimeEntry");
      }
      if (!endedAt) {
        throw new Error("endedAt is required to finalize");
      }
      if (typeof durationSeconds !== "number" || durationSeconds < 0) {
        throw new Error("durationSeconds must be a non-negative number");
      }
  
      this.endedAt = endedAt;
      this.durationSeconds = durationSeconds;
    }
  
    /**
     * Add or update notes for this entry.
     */
    addNotes(notes) {
      this.notes = notes;
    }

    /**
     * Add a break record to this entry.
     */
    addBreak(breakRecord) {
      if (!breakRecord) return;
      if (!Array.isArray(this.breaks)) {
        this.breaks = [];
      }
      this.breaks.push(breakRecord);
    }
  
    /**
     * Format duration as HH:MM:SS.
     */
    get formattedDuration() {
      const hours = Math.floor(this.durationSeconds / 3600);
      const minutes = Math.floor((this.durationSeconds % 3600) / 60);
      const seconds = this.durationSeconds % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
  
    /**
     * Serialize for storage/API.
     */
    toJSON() {
      return {
        id: this.id,
        taskId: this.taskId,
        taskTitle: this.taskTitle,
        startedAt: this.startedAt,
        endedAt: this.endedAt,
        durationSeconds: this.durationSeconds,
        notes: this.notes,
        breaks: this.breaks,
        createdAt: this.createdAt,
      };
    }
  
    /**
     * Deserialize from storage/API.
     */
    static fromJSON(data) {
      return new TimeEntry(data);
    }
  }
  