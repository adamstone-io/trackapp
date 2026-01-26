/**
 * Task represents a unit of work that can be tracked.
 * Tasks exist independently of time entries and can be:
 * - Created on-the-fly when starting a timer
 * - Pre-planned for future work
 * - Reused across multiple time entries
 * Tasks can optionally belong to a Project via projectId.
 */

export class Task {
    /**
     * @param {Object} data
     * @param {string} [data.id] - Unique identifier (generated if not provided)
     * @param {string} data.title - Task name/description
     * @param {string} [data.category] - Category for tagging (default: "Other")
     * @param {string} [data.projectId] - Optional reference to parent project
     * @param {string} [data.notes] - Additional notes
     * @param {string} [data.plannedStart] - ISO date string for planned start
     * @param {number} [data.plannedDuration] - Planned duration in seconds
     * @param {boolean} [data.archived] - Whether task is archived
     */
    constructor({
      id,
      title = "",
      category = "Other",
      projectId = null,
      notes = "",
      plannedStart = null,
      plannedDuration = null,
      archived = false,
      createdAt = null,
    }) {
      this.id = id ?? crypto.randomUUID();
      this.title = title.trim();
      this.category = category.trim().toLowerCase();
      this.projectId = projectId;
      this.notes = notes;
      this.plannedStart = plannedStart;
      this.plannedDuration = plannedDuration;
      this.archived = archived;
      this.createdAt = createdAt ?? new Date().toISOString();
    }
  
    /**
     * Archive this task (soft delete).
     */
    archive() {
      this.archived = true;
    }
  
    /**
     * Restore an archived task.
     */
    restore() {
      this.archived = false;
    }
  
    /**
     * Update task metadata.
     */
    update({ title, category, projectId, notes, plannedStart, plannedDuration }) {
      if (title !== undefined) this.title = title.trim();
      if (category !== undefined) this.category = category.trim().toLowerCase();
      if (projectId !== undefined) this.projectId = projectId;
      if (notes !== undefined) this.notes = notes;
      if (plannedStart !== undefined) this.plannedStart = plannedStart;
      if (plannedDuration !== undefined) this.plannedDuration = plannedDuration;
    }
  
    /**
     * Serialize for storage/API.
     */
    toJSON() {
      return {
        id: this.id,
        title: this.title,
        category: this.category,
        projectId: this.projectId,
        notes: this.notes,
        plannedStart: this.plannedStart,
        plannedDuration: this.plannedDuration,
        archived: this.archived,
        createdAt: this.createdAt,
      };
    }
  
    /**
     * Deserialize from storage/API.
     */
    static fromJSON(data) {
      return new Task(data);
    }
  }
  