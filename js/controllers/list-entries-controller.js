// controllers/list-entries-controller.js
import { EntriesView } from "../views/list-entries-view.js";
import {
  loadTimeEntries,
  loadMoments,
  loadTasks,
  loadProjects,
  saveTasks,
  updateTimeEntry,
  deleteTimeEntry,
  deleteMoment,
} from "../data/storage.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";
import { Task } from "../domain/task.js";

export function createEntriesController() {
  const modal = createTimeEntryModal({
    onSave: (payload) => {
      if (payload.id) {
        const durationSeconds = Math.round(
          (new Date(payload.endedAt) - new Date(payload.startedAt)) / 1000,
        );

        updateTimeEntry(payload.id, {
          taskTitle: payload.taskTitle,
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          durationSeconds,
        });

        // Update the task's projectId if changed
        if (payload.taskId && payload.projectId !== undefined) {
          const tasks = loadTasks();
          let taskIndex = tasks.findIndex((t) => t.id === payload.taskId);

          // If task doesn't exist, create it from the entry data
          if (taskIndex === -1) {
            const newTask = new Task({
              id: payload.taskId,
              title: payload.taskTitle,
              projectId: payload.projectId,
            });
            tasks.push(newTask);
            saveTasks(tasks);
          } else {
            const task = tasks[taskIndex];
            let needsSave = false;

            if (task.title !== payload.taskTitle) {
              task.update({ title: payload.taskTitle });
              needsSave = true;
            }
            if (task.category !== payload.category) {
              task.update({ category: payload.category });
              needsSave = true;
            }

            if (task.projectId !== payload.projectId) {
              task.update({ projectId: payload.projectId });
              saveTasks(tasks);
            }

            if (needsSave) {
              saveTasks(tasks);
            }
          }
        }
      } else {
        // Create is handled by your manual-entry flow; keep this explicit.
        console.warn("Create flow not wired in this controller yet:", payload);
      }

      refresh();
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
            onSelect: () => {
              deleteTimeEntry(entry.id);
              refresh();
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
            onSelect: () => {
              deleteMoment(moment.id);
              refresh();
            },
          },
        ],
      });

      menu.attachTo(btn);
      momentMenuDisposers.push(() => menu.dispose());
    });
  }

  function refresh() {
    const { startMs, endMs } = getTodayWindowMs();

    const todayEntries = loadTimeEntries().filter((entry) => {
      const ms = new Date(entry.startedAt).getTime();
      return ms >= startMs && ms < endMs;
    });

    const todayMoments = loadMoments().filter(
      (moment) => moment.timestampMs >= startMs && moment.timestampMs < endMs,
    );

    // Load tasks and projects to resolve project names for entries
    const tasks = loadTasks();
    const projects = loadProjects();
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Add project info to entries
    // Use toJSON() to get a plain object that spreads correctly
    const entriesWithProject = todayEntries.map((entry) => {
      const task = taskMap.get(entry.taskId);
      const project = task?.projectId ? projectMap.get(task.projectId) : null;
      const plainEntry =
        typeof entry.toJSON === "function" ? entry.toJSON() : entry;
      return {
        ...plainEntry,
        category: task?.category || null,
        projectId: task?.projectId || null,
        projectName: project?.name || null,
        projectColor: project?.color || null,
      };
    });

    const items = [
      ...entriesWithProject.map((entry) => ({
        kind: "entry",
        atMs: new Date(entry.startedAt).getTime(),
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
