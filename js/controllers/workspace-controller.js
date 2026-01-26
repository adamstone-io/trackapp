// js/controllers/workspace-controller.js
import {
    loadProjects,
    saveProjects,
    loadTasks,
    saveTasks,
    loadTimeEntries,
} from "../data/storage.js";
import { Project } from "../domain/project.js";
import { Task } from "../domain/task.js";
import { WorkspaceView } from "../views/workspace-view.js";

export function createWorkspaceController() {
    let projects = [];
    let tasks = [];
    let timeEntries = [];
    let editingProjectId = null;
    let editingTaskId = null;

    const unbind = WorkspaceView.bind({
        onAddProject: handleAddProject,
        onEditProject: handleEditProject,
        onArchiveProject: handleArchiveProject,
        onDeleteProject: handleDeleteProject,
        onProjectFormSubmit: handleProjectFormSubmit,
        onProjectFormCancel: handleProjectFormCancel,
        onAddTask: handleAddTask,
        onEditTask: handleEditTask,
        onDeleteTask: handleDeleteTask,
        onStartTask: handleStartTask,
        onTaskFormSubmit: handleTaskFormSubmit,
        onTaskFormCancel: handleTaskFormCancel,
    });

    function refresh() {
        projects = loadProjects();
        tasks = loadTasks();
        timeEntries = loadTimeEntries();

        const projectStats = calculateProjectStats();
        const taskTimeMap = calculateTaskTime();

        // Only show tasks that have no time entries (scheduled but not started)
        const scheduledTasks = tasks.filter(t => !taskTimeMap.has(t.id));

        WorkspaceView.renderProjects(projects, projectStats);
        WorkspaceView.renderTasks(scheduledTasks, projects, taskTimeMap);
    }

    function calculateProjectStats() {
        const stats = new Map();

        for (const project of projects) {
            const projectTasks = tasks.filter(t => t.projectId === project.id && !t.archived);
            const taskIds = new Set(projectTasks.map(t => t.id));
            
            const projectEntries = timeEntries.filter(e => taskIds.has(e.taskId));
            const totalSeconds = projectEntries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

            stats.set(project.id, {
                taskCount: projectTasks.length,
                totalSeconds,
            });
        }

        return stats;
    }

    function calculateTaskTime() {
        const taskTimeMap = new Map();

        for (const entry of timeEntries) {
            const current = taskTimeMap.get(entry.taskId) || 0;
            taskTimeMap.set(entry.taskId, current + (entry.durationSeconds || 0));
        }

        return taskTimeMap;
    }

    // Project handlers
    function handleAddProject() {
        editingProjectId = null;
        WorkspaceView.showProjectModal(null);
    }

    function handleEditProject(id) {
        const project = projects.find(p => p.id === id);
        if (!project) return;

        editingProjectId = id;
        WorkspaceView.showProjectModal(project);
    }

    function handleArchiveProject(id) {
        if (!confirm("Archive this project? It will be hidden from the list.")) return;

        const projectIndex = projects.findIndex(p => p.id === id);
        if (projectIndex !== -1) {
            projects[projectIndex].archive();
            saveProjects(projects);
        }
        refresh();
    }

    function handleDeleteProject(id) {
        if (!confirm("Delete this project permanently? Tasks will become unassigned.")) return;

        // Unassign tasks from this project
        const updatedTasks = tasks.map(t => {
            if (t.projectId === id) {
                const taskData = t.toJSON();
                taskData.projectId = null;
                return new Task(taskData);
            }
            return t;
        });
        saveTasks(updatedTasks);

        // Delete the project from the list
        projects = projects.filter(p => p.id !== id);
        saveProjects(projects);
        refresh();
    }

    function handleProjectFormSubmit(data) {
        if (!data.name || !data.name.trim()) {
            alert("Project name is required");
            return;
        }

        if (editingProjectId) {
            // Update existing project
            const projectIndex = projects.findIndex(p => p.id === editingProjectId);
            if (projectIndex !== -1) {
                projects[projectIndex].update(data);
                saveProjects(projects);
            }
        } else {
            // Create new project
            const project = new Project(data);
            projects.push(project);
            saveProjects(projects);
        }

        WorkspaceView.hideProjectModal();
        editingProjectId = null;
        refresh();
    }

    function handleProjectFormCancel() {
        WorkspaceView.hideProjectModal();
        editingProjectId = null;
    }

    // Task handlers
    function handleAddTask() {
        editingTaskId = null;
        WorkspaceView.showTaskModal(null, projects);
    }

    function handleEditTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        editingTaskId = id;
        WorkspaceView.showTaskModal(task, projects);
    }

    function handleDeleteTask(id) {
        if (!confirm("Delete this task? Time entries will be preserved.")) return;

        const updatedTasks = tasks.filter(t => t.id !== id);
        saveTasks(updatedTasks);
        refresh();
    }

    function handleStartTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        // Navigate to timer page with task info
        const params = new URLSearchParams({
            taskId: task.id,
            taskTitle: task.title,
        });
        window.location.href = `timer.html?${params.toString()}`;
    }

    function handleTaskFormSubmit(data) {
        if (!data.title || !data.title.trim()) {
            alert("Task title is required");
            return;
        }

        // Convert empty string projectId to null
        if (data.projectId === "") {
            data.projectId = null;
        }

        if (editingTaskId) {
            // Update existing task
            const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
            if (taskIndex !== -1) {
                tasks[taskIndex].update(data);
                saveTasks(tasks);
            }
        } else {
            // Create new task
            const task = new Task(data);
            tasks.push(task);
            saveTasks(tasks);
        }

        WorkspaceView.hideTaskModal();
        editingTaskId = null;
        refresh();
    }

    function handleTaskFormCancel() {
        WorkspaceView.hideTaskModal();
        editingTaskId = null;
    }

    // Initial load
    refresh();

    return {
        refresh,
        dispose: () => {
            unbind();
        },
    };
}
