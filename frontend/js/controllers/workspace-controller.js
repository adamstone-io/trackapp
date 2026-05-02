// js/controllers/workspace-controller.js
import {
  loadProjects,
  loadTasks,
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
  let editingProjectId = null;
  let editingTaskId = null;

  // Date picker for filtering scheduled tasks
  const datePicker = document.getElementById("tasks-date-picker");
  const dateLabel = document.getElementById("tasks-date-label");

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  if (datePicker) {
    datePicker.value = todayStr;
    datePicker.addEventListener("change", () => {
      updateDateLabel();
      renderScheduledTasks();
    });
  }

  function getSelectedDateStr() {
    return datePicker?.value || todayStr;
  }

  function updateDateLabel() {
    if (!dateLabel) return;
    const val = getSelectedDateStr();
    if (val === todayStr) {
      dateLabel.textContent = "Scheduled Tasks — Today";
    } else {
      const d = new Date(`${val}T00:00:00`);
      const label = new Intl.DateTimeFormat(undefined, {
        weekday: "long", month: "long", day: "numeric",
      }).format(d);
      dateLabel.textContent = `Scheduled Tasks — ${label}`;
    }
  }

  function taskMatchesDate(task, dateStr) {
    const rawStart = task.planned_start ?? task.plannedStart ?? null;
    if (!rawStart) return false;
    const taskDate = new Date(rawStart);
    const y = taskDate.getFullYear();
    const m = String(taskDate.getMonth() + 1).padStart(2, "0");
    const day = String(taskDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}` === dateStr;
  }

  function renderScheduledTasks() {
    const taskTimeMap = calculateTaskTime();
    const dateStr = getSelectedDateStr();
    const scheduled = tasks.filter((t) => !t.archived && !taskTimeMap.has(t.id) && taskMatchesDate(t, dateStr));
    WorkspaceView.renderTasks(scheduled, [], projects, taskTimeMap);
  }

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

    const projectStats = calculateProjectStats();
    WorkspaceView.renderProjects(projects, projectStats);
    updateDateLabel();
    renderScheduledTasks();
  }

  function calculateProjectStats() {
    const stats = new Map();

    for (const project of projects) {
      const projectTasks = tasks.filter(
        (t) => (t.project ?? t.projectId) === project.id && !t.archived,
      );
      const totalSeconds = projectTasks.reduce(
        (sum, t) => sum + (t.total_seconds ?? 0),
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

    for (const task of tasks) {
      const seconds = task.total_seconds ?? 0;
      if (seconds > 0) {
        taskTimeMap.set(task.id, seconds);
      }
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
    if (!confirm("Remove this task from your schedule? Time entries will be preserved.")) return;
    await updateTask(id, { archived: true });
    await refresh();
  }

  function handleStartTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Navigate to timer page with task info
    const plannedDuration = task.planned_duration ?? task.plannedDuration ?? null;
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
      taskCategory: task.category ?? "",
      taskProjectId: String(task.projectId ?? task.project ?? ""),
      autoStart: "1",
      autoCountdown: "1",
      ...(plannedDuration ? { countdownDuration: String(plannedDuration) } : {}),
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
      project: data.projectId ?? null,       // FK field expected by DRF
      planned_duration: data.plannedDuration ?? null,
      planned_start: data.plannedStart ?? null,
    };
    delete payload.projectId;
    delete payload.plannedDuration;
    delete payload.plannedStart;

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
