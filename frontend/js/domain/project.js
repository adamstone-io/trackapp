/**
 * Project represents a collection of related tasks.
 * Projects exist independently and tasks can optionally reference them.
 * Time is calculated by aggregating time entries from all associated tasks.
 */

export class Project {
    /**
     * @param {Object} data
     * @param {string} [data.id] - Unique identifier (generated if not provided)
     * @param {string} data.name - Project name
     * @param {string} [data.description] - Project description
     * @param {string} [data.color] - Color for visual identification (hex or name)
     * @param {boolean} [data.archived] - Whether project is archived
     * @param {string} [data.createdAt] - ISO date string for creation time
     */
    constructor({
        id,
        name = "",
        description = "",
        color = "#6366f1",
        archived = false,
        createdAt = null,
    }) {
        if (!name || !name.trim()) {
            throw new Error("Project requires a name");
        }

        this.id = id ?? crypto.randomUUID();
        this.name = name.trim();
        this.description = description;
        this.color = color;
        this.archived = archived;
        this.createdAt = createdAt ?? new Date().toISOString();
    }

    /**
     * Archive this project (soft delete).
     */
    archive() {
        this.archived = true;
    }

    /**
     * Restore an archived project.
     */
    restore() {
        this.archived = false;
    }

    /**
     * Update project metadata.
     */
    update({ name, description, color }) {
        if (name !== undefined) this.name = name.trim();
        if (description !== undefined) this.description = description;
        if (color !== undefined) this.color = color;
    }

    /**
     * Serialize for storage/API.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            color: this.color,
            archived: this.archived,
            createdAt: this.createdAt,
        };
    }

    /**
     * Deserialize from storage/API.
     */
    static fromJSON(data) {
        return new Project(data);
    }
}
