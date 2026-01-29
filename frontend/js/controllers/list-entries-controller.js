// controllers/list-entries-controller.js
import { EntriesView } from "../views/list-entries-view.js";
import {
  loadTimeEntries,
  loadMoments,
  loadTasks,
  loadProjects,
  updateTimeEntry,
  deleteTimeEntry,
  deleteMoment,
  updateTask,
  createTask,
} from "../data/storage.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";
import { Task } from "../domain/task.js";

export function createEntriesController() {
  const modal = createTimeEntryModal({
    onSave: async (payload) => {
      if (payload.id) {
        const durationSeconds = Math.round(
          (new Date(payload.endedAt) - new Date(payload.startedAt)) / 1000,
        );

        await updateTimeEntry(payload.id, {
          taskTitle: payload.taskTitle,
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          durationSeconds,
        });

        // Update the task's projectId if changed
        if (payload.taskId && payload.projectId !== undefined) {
          const tasks = await loadTasks();
          const existingTask = tasks.find((t) => t.id === payload.taskId);

          // If task doesn't exist, create it from the entry data
          if (!existingTask) {
            const newTask = new Task({
              id: payload.taskId,
              title: payload.taskTitle,
              projectId: payload.projectId,
            });
            const taskPayload = {
              ...newTask.toJSON(),
              project: newTask.projectId ?? null,
            };
            delete taskPayload.projectId;
            await createTask(taskPayload);
          } else {
            // Build patch for any changed fields
            const patch = {};

            if (existingTask.title !== payload.taskTitle) {
              patch.title = payload.taskTitle;
            }
            if (existingTask.category !== payload.category) {
              patch.category = payload.category;
            }
            if (existingTask.projectId !== payload.projectId) {
              patch.project = payload.projectId ?? null;
            }

            if (Object.keys(patch).length > 0) {
              await updateTask(payload.taskId, patch);
            }
          }
        }
      } else {
        // Create is handled by your manual-entry flow; keep this explicit.
        console.warn("Create flow not wired in this controller yet:", payload);
      }

      await refresh();
    },
  });

  /** @type {Array<Function>} */
  let menuDisposers = [];
  /** @type {Array<Function>} */
  let momentMenuDisposers = [];
  /** @type {Function | null} */
  let onEditMoment = null;

  function getTodayWindowMs() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  function disposeMenus() {
    for (const dispose of menuDisposers) dispose();
    menuDisposers = [];
  }

  function disposeMomentMenus() {
    for (const dispose of momentMenuDisposers) dispose();
    momentMenuDisposers = [];
  }

  function attachEntryMenus(entries) {
    disposeMenus();

    const listEl = EntriesView.list();
    const buttons = listEl.querySelectorAll("[data-entry-menu]");

    buttons.forEach((btn) => {
      const card = btn.closest("[data-entry-id]");
      if (!card) return;

      const entryId = card.getAttribute("data-entry-id");
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;

      const menu = createDropdownMenu({
        items: [
          {
            label: "Edit",
            onSelect: () => modal.openEdit(entry),
          },
          {
            label: "Delete",
            onSelect: async () => {
              await deleteTimeEntry(entry.id);
              await refresh();
            },
          },
        ],
      });

      menu.attachTo(btn);
      menuDisposers.push(() => menu.dispose());
    });
  }

  function attachMomentMenus(moments) {
    disposeMomentMenus();

    const listEl = EntriesView.list();
    const buttons = listEl.querySelectorAll("[data-moment-menu]");

    buttons.forEach((btn) => {
      const card = btn.closest("[data-moment-id]");
      if (!card) return;

      const momentId = card.getAttribute("data-moment-id");
      const moment = moments.find((m) => m.id === momentId);
      if (!moment) return;

      const menu = createDropdownMenu({
        items: [
          {
            label: "Edit",
            onSelect: () => {
              if (typeof onEditMoment === "function") {
                onEditMoment(moment);
              }
            },
          },
          {
            label: "Delete",
            onSelect: async () => {
              await deleteMoment(moment.id);
              await refresh();
            },
          },
        ],
      });

      menu.attachTo(btn);
      momentMenuDisposers.push(() => menu.dispose());
    });
  }

  async function refresh() {
    const { startMs, endMs } = getTodayWindowMs();

    const allEntries = await loadTimeEntries();
    const todayEntries = allEntries.filter((entry) => {
      const ms = new Date(entry.startedAt ?? entry.started_at).getTime();
      return ms >= startMs && ms < endMs;
    });

    const allMoments = await loadMoments();
    const todayMoments = allMoments.filter(
      (moment) => moment.timestampMs >= startMs && moment.timestampMs < endMs,
    );

    // Load tasks and projects to resolve project names for entries
    const tasks = await loadTasks();
    const projects = await loadProjects();
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Add project info to entries
    // Use toJSON() to get a plain object that spreads correctly
    const entriesWithProject = todayEntries.map((entry) => {
      const taskId = entry.taskId ?? entry.task;
      const task = taskMap.get(taskId);
      const projectId = task?.projectId ?? task?.project;
      const project = projectId ? projectMap.get(projectId) : null;
      const plainEntry =
        typeof entry.toJSON === "function" ? entry.toJSON() : entry;
      return {
        ...plainEntry,
        taskId: taskId,
        category: task?.category || null,
        projectId: projectId || null,
        projectName: project?.name || null,
        projectColor: project?.color || null,
      };
    });

    const items = [
      ...entriesWithProject.map((entry) => ({
        kind: "entry",
        atMs: new Date(entry.startedAt ?? entry.started_at).getTime(),
        entry,
      })),
      ...todayMoments.map((moment) => ({
        kind: "moment",
        atMs: moment.timestampMs,
        moment,
      })),
    ].sort((a, b) => {
      if (b.atMs !== a.atMs) return b.atMs - a.atMs;
      // Tie-breaker: show moments before entries if same timestamp
      if (a.kind !== b.kind) return a.kind === "moment" ? -1 : 1;
      return 0;
    });

    EntriesView.render(items);

    // Menus only exist for entries - use entriesWithProject so edit modal gets projectId
    attachEntryMenus(entriesWithProject);
    attachMomentMenus(todayMoments);
  }

  refresh();

  return {
    refresh,
    setMomentEditor: (handler) => {
      onEditMoment = typeof handler === "function" ? handler : null;
    },
    dispose: () => {
      disposeMenus();
      disposeMomentMenus();
      modal.dispose();
    },
  };
}
