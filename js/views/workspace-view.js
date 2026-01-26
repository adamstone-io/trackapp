// js/views/workspace-view.js
import { createDropdownMenu } from "./components/dropdown-menu.js";

// Store dropdown menus for cleanup
const projectDropdownMenus = new Map();

// Store callbacks for use in renderProjects
let projectCallbacks = {};

export const WorkspaceView = {
    // Project elements
    projectListEl: () => document.getElementById("project-list"),
    projectListEmptyEl: () => document.getElementById("project-list-empty"),
    addProjectBtn: () => document.getElementById("add-project-btn"),
    
    // Project modal elements
    projectModal: () => document.getElementById("project-modal"),
    projectModalTitle: () => document.getElementById("project-modal-title"),
    projectForm: () => document.getElementById("project-form"),
    projectNameInput: () => document.getElementById("project-name"),
    projectDescriptionInput: () => document.getElementById("project-description"),
    projectColorInput: () => document.getElementById("project-color"),
    projectSaveBtn: () => document.getElementById("project-save-btn"),
    projectCancelBtn: () => document.getElementById("project-cancel-btn"),

    // Task elements
    taskListEl: () => document.getElementById("task-list"),
    taskListEmptyEl: () => document.getElementById("task-list-empty"),
    addTaskBtn: () => document.getElementById("add-task-btn"),

    // Task modal elements
    taskModal: () => document.getElementById("task-modal"),
    taskModalTitle: () => document.getElementById("task-modal-title"),
    taskForm: () => document.getElementById("task-form"),
    taskTitleInput: () => document.getElementById("task-title"),
    taskProjectSelect: () => document.getElementById("task-project"),
    taskCategoryInput: () => document.getElementById("task-category"),
    taskNotesInput: () => document.getElementById("task-notes"),
    taskPlannedStartInput: () => document.getElementById("task-planned-start"),
    taskPlannedDurationInput: () => document.getElementById("task-planned-duration"),
    taskSaveBtn: () => document.getElementById("task-save-btn"),
    taskCancelBtn: () => document.getElementById("task-cancel-btn"),

    bind({
        onAddProject,
        onEditProject,
        onArchiveProject,
        onDeleteProject,
        onProjectFormSubmit,
        onProjectFormCancel,
        onAddTask,
        onEditTask,
        onDeleteTask,
        onStartTask,
        onTaskFormSubmit,
        onTaskFormCancel,
    } = {}) {
        const addProjectBtn = this.addProjectBtn();
        const projectForm = this.projectForm();
        const projectCancelBtn = this.projectCancelBtn();
        const addTaskBtn = this.addTaskBtn();
        const taskForm = this.taskForm();
        const taskCancelBtn = this.taskCancelBtn();
        const projectListEl = this.projectListEl();
        const taskListEl = this.taskListEl();

        // Add project button
        const handleAddProject = () => {
            if (typeof onAddProject === "function") onAddProject();
        };
        if (addProjectBtn) addProjectBtn.addEventListener("click", handleAddProject);

        // Project form submit
        const handleProjectFormSubmit = (e) => {
            e.preventDefault();
            if (typeof onProjectFormSubmit === "function") {
                const data = {
                    name: this.projectNameInput()?.value || "",
                    description: this.projectDescriptionInput()?.value || "",
                    color: this.projectColorInput()?.value || "#6366f1",
                };
                onProjectFormSubmit(data);
            }
        };
        if (projectForm) projectForm.addEventListener("submit", handleProjectFormSubmit);

        // Project form cancel
        const handleProjectFormCancel = () => {
            if (typeof onProjectFormCancel === "function") onProjectFormCancel();
        };
        if (projectCancelBtn) projectCancelBtn.addEventListener("click", handleProjectFormCancel);

        // Add task button
        const handleAddTask = () => {
            if (typeof onAddTask === "function") onAddTask();
        };
        if (addTaskBtn) addTaskBtn.addEventListener("click", handleAddTask);

        // Task form submit
        const handleTaskFormSubmit = (e) => {
            e.preventDefault();
            if (typeof onTaskFormSubmit === "function") {
                const plannedDurationMinutes = parseInt(this.taskPlannedDurationInput()?.value, 10);
                const data = {
                    title: this.taskTitleInput()?.value || "",
                    projectId: this.taskProjectSelect()?.value || null,
                    category: this.taskCategoryInput()?.value || "Other",
                    notes: this.taskNotesInput()?.value || "",
                    plannedStart: this.taskPlannedStartInput()?.value || null,
                    plannedDuration: plannedDurationMinutes ? plannedDurationMinutes * 60 : null,
                };
                onTaskFormSubmit(data);
            }
        };
        if (taskForm) taskForm.addEventListener("submit", handleTaskFormSubmit);

        // Task form cancel
        const handleTaskFormCancel = () => {
            if (typeof onTaskFormCancel === "function") onTaskFormCancel();
        };
        if (taskCancelBtn) taskCancelBtn.addEventListener("click", handleTaskFormCancel);

        // Store project callbacks for dropdown menus
        projectCallbacks = {
            onEditProject,
            onArchiveProject,
            onDeleteProject,
        };

        // Task list delegation (edit, delete, start)
        const handleTaskListClick = (e) => {
            const editBtn = e.target.closest("[data-action='edit-task']");
            const deleteBtn = e.target.closest("[data-action='delete-task']");
            const startBtn = e.target.closest("[data-action='start-task']");

            if (editBtn) {
                const id = editBtn.dataset.id;
                if (typeof onEditTask === "function") onEditTask(id);
            } else if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (typeof onDeleteTask === "function") onDeleteTask(id);
            } else if (startBtn) {
                const id = startBtn.dataset.id;
                if (typeof onStartTask === "function") onStartTask(id);
            }
        };
        if (taskListEl) taskListEl.addEventListener("click", handleTaskListClick);

        // Return unbind function
        return () => {
            if (addProjectBtn) addProjectBtn.removeEventListener("click", handleAddProject);
            if (projectForm) projectForm.removeEventListener("submit", handleProjectFormSubmit);
            if (projectCancelBtn) projectCancelBtn.removeEventListener("click", handleProjectFormCancel);
            if (addTaskBtn) addTaskBtn.removeEventListener("click", handleAddTask);
            if (taskForm) taskForm.removeEventListener("submit", handleTaskFormSubmit);
            if (taskCancelBtn) taskCancelBtn.removeEventListener("click", handleTaskFormCancel);
            if (taskListEl) taskListEl.removeEventListener("click", handleTaskListClick);
            // Dispose project dropdown menus
            for (const menu of projectDropdownMenus.values()) {
                menu.dispose();
            }
            projectDropdownMenus.clear();
        };
    },

    renderProjects(projects, projectStats) {
        const listEl = this.projectListEl();
        const emptyEl = this.projectListEmptyEl();

        if (!listEl || !emptyEl) return;

        // Dispose old dropdown menus
        for (const menu of projectDropdownMenus.values()) {
            menu.dispose();
        }
        projectDropdownMenus.clear();

        const activeProjects = projects.filter(p => !p.archived);

        if (activeProjects.length === 0) {
            listEl.innerHTML = "";
            listEl.style.display = "none";
            emptyEl.style.display = "block";
            return;
        }

        emptyEl.style.display = "none";
        listEl.style.display = "flex";

        listEl.innerHTML = activeProjects
            .map((project) => {
                const stats = projectStats.get(project.id) || { taskCount: 0, totalSeconds: 0 };
                const timeFormatted = this.formatDuration(stats.totalSeconds);

                return `
                    <div class="project-item" style="--project-color: ${project.color}">
                        <div class="project-item__header">
                            <div class="project-item__header-content">
                                <h3 class="project-item__name">${this.escapeHtml(project.name)}</h3>
                                ${project.description ? `<p class="project-item__description">${this.escapeHtml(project.description)}</p>` : ""}
                            </div>
                            <button
                                id="menu-project-${project.id}"
                                class="icon-btn"
                                aria-label="More options for ${this.escapeHtml(project.name)}"
                                type="button"
                            >
                                <svg
                                    class="icon"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    aria-hidden="true"
                                >
                                    <circle cx="8" cy="2" r="1.5" />
                                    <circle cx="8" cy="8" r="1.5" />
                                    <circle cx="8" cy="14" r="1.5" />
                                </svg>
                            </button>
                        </div>
                        <div class="project-item__stats">
                            <div class="project-stat">
                                <span class="project-stat__value">${stats.taskCount}</span>
                                <span class="project-stat__label">Tasks</span>
                            </div>
                            <div class="project-stat">
                                <span class="project-stat__value">${timeFormatted}</span>
                                <span class="project-stat__label">Time Spent</span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");

        // Create dropdown menus for each project
        activeProjects.forEach((project) => {
            const menuBtn = document.getElementById(`menu-project-${project.id}`);
            if (menuBtn) {
                const menuItems = [
                    { 
                        label: "Edit", 
                        onSelect: () => {
                            if (typeof projectCallbacks.onEditProject === "function") {
                                projectCallbacks.onEditProject(project.id);
                            }
                        }
                    },
                    { 
                        label: "Archive", 
                        onSelect: () => {
                            if (typeof projectCallbacks.onArchiveProject === "function") {
                                projectCallbacks.onArchiveProject(project.id);
                            }
                        }
                    },
                    { 
                        label: "Delete", 
                        onSelect: () => {
                            if (typeof projectCallbacks.onDeleteProject === "function") {
                                projectCallbacks.onDeleteProject(project.id);
                            }
                        }
                    },
                ];

                const menu = createDropdownMenu({ items: menuItems });
                menu.attachTo(menuBtn);
                projectDropdownMenus.set(project.id, menu);
            }
        });
    },

    renderTasks(tasks, projects, taskTimeMap) {
        const listEl = this.taskListEl();
        const emptyEl = this.taskListEmptyEl();

        if (!listEl || !emptyEl) return;

        const activeTasks = tasks.filter(t => !t.archived);

        if (activeTasks.length === 0) {
            listEl.innerHTML = "";
            listEl.style.display = "none";
            emptyEl.style.display = "block";
            return;
        }

        emptyEl.style.display = "none";
        listEl.style.display = "flex";

        // Group tasks by project
        const projectMap = new Map(projects.map(p => [p.id, p]));
        const groups = new Map();
        const noProjectTasks = [];

        for (const task of activeTasks) {
            if (task.projectId && projectMap.has(task.projectId)) {
                if (!groups.has(task.projectId)) {
                    groups.set(task.projectId, []);
                }
                groups.get(task.projectId).push(task);
            } else {
                noProjectTasks.push(task);
            }
        }

        let html = "";

        // Render grouped tasks
        for (const [projectId, projectTasks] of groups) {
            const project = projectMap.get(projectId);
            html += this.renderTaskGroup(project.name, project.color, projectTasks, taskTimeMap);
        }

        // Render ungrouped tasks
        if (noProjectTasks.length > 0) {
            html += this.renderTaskGroup("No Project", "#888888", noProjectTasks, taskTimeMap);
        }

        listEl.innerHTML = html;
    },

    renderTaskGroup(groupName, color, tasks, taskTimeMap) {
        const taskItems = tasks
            .map((task) => {
                const timeSpent = taskTimeMap.get(task.id) || 0;
                const timeFormatted = this.formatDuration(timeSpent);
                const plannedDuration = task.plannedDuration ? `${Math.round(task.plannedDuration / 60)}m planned` : "";
                const plannedStart = task.plannedStart ? this.formatDateTime(task.plannedStart) : "";

                return `
                    <div class="task-item">
                        <div class="task-item__content">
                            <h4 class="task-item__title">${this.escapeHtml(task.title)}</h4>
                            <div class="task-item__meta">
                                ${task.category && task.category !== "other" ? `<span class="task-item__category">${this.escapeHtml(task.category)}</span>` : ""}
                                ${plannedStart ? `<span class="task-item__scheduled">${plannedStart}</span>` : ""}
                                ${plannedDuration ? `<span class="task-item__duration">${plannedDuration}</span>` : ""}
                            </div>
                        </div>
                        <span class="task-item__time-spent">${timeFormatted}</span>
                        <div class="task-item__actions">
                            <button class="btn btn--primary" data-action="start-task" data-id="${task.id}">Start</button>
                            <button class="btn btn--outline" data-action="edit-task" data-id="${task.id}">Edit</button>
                            <button class="btn btn--outline" data-action="delete-task" data-id="${task.id}">Delete</button>
                        </div>
                    </div>
                `;
            })
            .join("");

        return `
            <div class="task-group">
                <div class="task-group__header">
                    <div class="task-group__color" style="background-color: ${color}"></div>
                    <h3 class="task-group__name">${this.escapeHtml(groupName)}</h3>
                    <span class="task-group__count">${tasks.length} task${tasks.length === 1 ? "" : "s"}</span>
                </div>
                ${taskItems}
            </div>
        `;
    },

    populateProjectSelect(projects) {
        const select = this.taskProjectSelect();
        if (!select) return;

        const activeProjects = projects.filter(p => !p.archived);
        
        select.innerHTML = `<option value="">No project (one-off task)</option>` +
            activeProjects
                .map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`)
                .join("");
    },

    showProjectModal(project = null) {
        const modal = this.projectModal();
        const title = this.projectModalTitle();
        const nameInput = this.projectNameInput();
        const descriptionInput = this.projectDescriptionInput();
        const colorInput = this.projectColorInput();

        if (!modal) return;

        if (project) {
            title.textContent = "Edit Project";
            nameInput.value = project.name;
            descriptionInput.value = project.description || "";
            colorInput.value = project.color || "#6366f1";
        } else {
            title.textContent = "New Project";
            nameInput.value = "";
            descriptionInput.value = "";
            colorInput.value = "#6366f1";
        }

        modal.classList.remove("hidden");
        nameInput.focus();
    },

    hideProjectModal() {
        const modal = this.projectModal();
        if (modal) modal.classList.add("hidden");
    },

    showTaskModal(task = null, projects = []) {
        const modal = this.taskModal();
        const title = this.taskModalTitle();
        const titleInput = this.taskTitleInput();
        const projectSelect = this.taskProjectSelect();
        const categoryInput = this.taskCategoryInput();
        const notesInput = this.taskNotesInput();
        const plannedStartInput = this.taskPlannedStartInput();
        const plannedDurationInput = this.taskPlannedDurationInput();

        if (!modal) return;

        this.populateProjectSelect(projects);

        if (task) {
            title.textContent = "Edit Task";
            titleInput.value = task.title;
            projectSelect.value = task.projectId || "";
            categoryInput.value = task.category || "";
            notesInput.value = task.notes || "";
            plannedStartInput.value = task.plannedStart ? task.plannedStart.slice(0, 16) : "";
            plannedDurationInput.value = task.plannedDuration ? Math.round(task.plannedDuration / 60) : "";
        } else {
            title.textContent = "New Task";
            titleInput.value = "";
            projectSelect.value = "";
            categoryInput.value = "";
            notesInput.value = "";
            plannedStartInput.value = "";
            plannedDurationInput.value = "";
        }

        modal.classList.remove("hidden");
        titleInput.focus();
    },

    hideTaskModal() {
        const modal = this.taskModal();
        if (modal) modal.classList.add("hidden");
    },

    formatDuration(seconds) {
        const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    formatDateTime(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    },

    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    },
};
