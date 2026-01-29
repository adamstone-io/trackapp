// js/controllers/workspace-controller.js
import {
  loadProjects,
  loadTasks,
  loadTimeEntries,
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
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

  async function refresh() {
    projects = await loadProjects();
    tasks = await loadTasks();
    timeEntries = await loadTimeEntries();

    const projectStats = calculateProjectStats();
    const taskTimeMap = calculateTaskTime();
    const scheduledTasks = tasks.filter((t) => !taskTimeMap.has(t.id));

    WorkspaceView.renderProjects(projects, projectStats);
    WorkspaceView.renderTasks(scheduledTasks, projects, taskTimeMap);
  }

  function calculateProjectStats() {
    const stats = new Map();

    for (const project of projects) {
      const projectTasks = tasks.filter(
        (t) => t.projectId === project.id && !t.archived,
      );
      const taskIds = new Set(projectTasks.map((t) => t.id));

      const projectEntries = timeEntries.filter((e) => taskIds.has(e.taskId));
      const totalSeconds = projectEntries.reduce(
        (sum, e) => sum + (e.durationSeconds || 0),
        0,
      );

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
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    editingProjectId = id;
    WorkspaceView.showProjectModal(project);
  }

  async function handleArchiveProject(id) {
    if (!confirm("Archive this project? It will be hidden from the list."))
      return;
    await updateProject(id, { archived: true });
    await refresh();
  }

  async function handleDeleteProject(id) {
    if (
      !confirm("Delete this project permanently? Tasks will become unassigned.")
    )
      return;

    // Unassign tasks from project
    const affected = tasks.filter((t) => t.projectId === id);
    await Promise.all(affected.map((t) => updateTask(t.id, { project: null })));

    await deleteProject(id);
    await refresh();
  }

  async function handleProjectFormSubmit(data) {
    if (!data.name || !data.name.trim()) {
      alert("Project name is required");
      return;
    }

    if (editingProjectId) {
      await updateProject(editingProjectId, data);
    } else {
      await createProject(data);
    }

    WorkspaceView.hideProjectModal();
    editingProjectId = null;
    await refresh();
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
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    editingTaskId = id;
    WorkspaceView.showTaskModal(task, projects);
  }

  async function handleDeleteTask(id) {
    if (!confirm("Delete this task? Time entries will be preserved.")) return;
    await deleteTask(id);
    await refresh();
  }

  function handleStartTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Navigate to timer page with task info
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
    });
    window.location.href = `timer.html?${params.toString()}`;
  }

  async function handleTaskFormSubmit(data) {
    if (!data.title || !data.title.trim()) {
      alert("Task title is required");
      return;
    }

    if (data.projectId === "") data.projectId = null;

    const payload = {
      ...data,
      project: data.projectId ?? null, // FK field expected by DRF
    };
    delete payload.projectId;

    if (editingTaskId) {
      await updateTask(editingTaskId, payload);
    } else {
      await createTask(payload);
    }

    WorkspaceView.hideTaskModal();
    editingTaskId = null;
    await refresh();
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
