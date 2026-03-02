// controllers/list-entries-controller.js
import { EntriesView } from "../views/list-entries-view.js";
import {
  loadTodayEntries,
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
          (new Date(payload.endedAt) - new Date(payload.startedAt)) / 1000
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

  /**
   * Dispose all entry menus
   */
  function disposeMenus() {
    for (const dispose of menuDisposers) dispose();
    menuDisposers = [];
  }

  /**
   * Dispose all moment menus
   */
  function disposeMomentMenus() {
    for (const dispose of momentMenuDisposers) dispose();
    momentMenuDisposers = [];
  }

  /**
   * Attach dropdown menus to time entry cards
   * @param {Array} entries - Time entries with project info
   */
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

  /**
   * Attach dropdown menus to moment cards
   * @param {Array} moments - Moments
   */
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

  /**
   * Parse API entry data to match existing format
   * @param {Object} apiEntry - Entry from API
   * @returns {Object} Normalized entry
   */
  function parseApiEntry(apiEntry) {
    const { type, id, data } = apiEntry;

    if (type === "time_entry") {
      return {
        id,
        taskId: data.task,
        taskTitle: data.task_title,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        durationSeconds: data.duration_seconds,
        notes: data.notes || "",
        breaks: data.breaks || [],
        createdAt: data.created_at,
      };
    }

    if (type === "moment") {
      return {
        id,
        description: data.description,
        category: data.category,
        timestamp: data.timestamp,
        timestampMs: new Date(data.timestamp).getTime(),
        taskId: data.task,
        taskTitle: data.task_title,
        isMilestone: data.is_milestone,
        createdAt: data.created_at,
      };
    }

    return null;
  }

  /**
   * Refresh the entries list
   * Uses optimized single API call that includes enriched data (project info).
   * Backend already handles filtering, sorting, and enrichment.
   */
  async function refresh() {
    try {
      // Single optimized API call - backend returns enriched data
      const todayData = await loadTodayEntries();

      // Separate entries and moments with enriched data from backend
      const entriesWithProject = [];
      const moments = [];

      for (const item of todayData) {
        if (item.type === "time_entry") {
          const entry = parseApiEntry(item);
          if (!entry) continue;

          // Backend now provides project info directly in the response
          entriesWithProject.push({
            ...entry,
            projectId: item.data.project_id || null,
            projectName: item.data.project_name || null,
            projectColor: item.data.project_color || null,
          });
        } else if (item.type === "moment") {
          const moment = parseApiEntry(item);
          if (moment) {
            moments.push(moment);
          }
        }
      }

      // Build items array for view (backend already sorted with latest on top)
      const items = todayData.map((item) => {
        if (item.type === "time_entry") {
          const entry = entriesWithProject.find((e) => e.id === item.id);
          return {
            kind: "entry",
            atMs: new Date(item.sort_time).getTime(),
            entry,
          };
        } else {
          const moment = moments.find((m) => m.id === item.id);
          return {
            kind: "moment",
            atMs: new Date(item.sort_time).getTime(),
            moment,
          };
        }
      });

      // Render the view (maintains backend sort order - latest on top)
      EntriesView.render(items);

      // Attach menus
      attachEntryMenus(entriesWithProject);
      attachMomentMenus(moments);
    } catch (error) {
      console.error("Failed to refresh entries:", error);
      // Optionally show error in UI
      EntriesView.renderError(
        "Failed to load entries. Please refresh the page."
      );
    }
  }

  // ---------- INLINE EDITING ----------

  function toTimeInput(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function buildIso(isoString, timeValue) {
    const d = new Date(isoString);
    const [hh, mm] = timeValue.split(":").map(Number);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  }

  function setupInlineEditing() {
    const list = EntriesView.list();

    list.addEventListener("click", (e) => {
      const editable = e.target.closest(".entry-card__editable");
      if (!editable) return;

      const card = editable.closest("[data-entry-id]");
      if (!card) return;

      const entryId = card.dataset.entryId;
      const currentTitle = card.dataset.taskTitle;
      const startedAt = card.dataset.startedAt;
      const endedAt = card.dataset.endedAt;

      if (editable.classList.contains("entry-card__title")) {
        startTitleEdit(editable, entryId, currentTitle);
      } else if (editable.classList.contains("entry-card__time")) {
        startTimeEdit(editable, entryId, startedAt, endedAt);
      }
    });
  }

  function startTitleEdit(span, entryId, currentTitle) {
    if (span.querySelector("input")) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentTitle;
    input.className = "entry-inline-input entry-inline-input--title";

    let saved = false;
    async function save() {
      if (saved) return;
      saved = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        try {
          const tasks = await loadTasks();
          const normalized = newTitle.toLowerCase();
          let task = tasks.find(
            (t) => (t.title ?? "").trim().toLowerCase() === normalized,
          );
          if (!task) {
            const newTask = new Task({ title: newTitle });
            const payload = { ...newTask.toJSON(), project: null };
            delete payload.projectId;
            task = await createTask(payload);
          }
          await updateTimeEntry(entryId, { taskTitle: newTitle, task: task.id });
          await refresh();
        } catch {
          await refresh();
        }
      } else {
        span.textContent = currentTitle;
        span.classList.remove("entry-card__editing");
      }
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") { saved = true; span.textContent = currentTitle; span.classList.remove("entry-card__editing"); }
    });
    input.addEventListener("blur", save);

    span.textContent = "";
    span.classList.add("entry-card__editing");
    span.appendChild(input);
    input.focus();
    input.select();
  }

  function makeClockIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  }

  function makeTimeInputWrap(input) {
    const wrap = document.createElement("span");
    wrap.className = "entry-time-input-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "entry-clock-btn";
    btn.innerHTML = makeClockIcon();
    btn.setAttribute("aria-label", "Pick time");

    btn.addEventListener("mousedown", (e) => {
      // Keep the click as an explicit picker-open action.
      e.preventDefault();
    });
    btn.addEventListener("click", () => {
      input.focus();
      try { input.showPicker(); } catch {}
    });

    wrap.appendChild(input);
    wrap.appendChild(btn);
    return wrap;
  }

  function startTimeEdit(span, entryId, startedAt, endedAt) {
    if (span.querySelector("input")) return;

    const startVal = toTimeInput(startedAt);
    const endVal = toTimeInput(endedAt);

    const wrap = document.createElement("span");
    wrap.className = "entry-inline-time-wrap";

    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.value = startVal;
    startInput.className = "entry-inline-input entry-inline-input--time";

    const sep = document.createElement("span");
    sep.textContent = "–";
    sep.className = "entry-inline-sep";

    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.value = endVal;
    endInput.className = "entry-inline-input entry-inline-input--time";

    wrap.appendChild(makeTimeInputWrap(startInput));
    wrap.appendChild(sep);
    wrap.appendChild(makeTimeInputWrap(endInput));

    let saveTimer = null;
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        if (document.activeElement === startInput || document.activeElement === endInput) return;
        const newStart = buildIso(startedAt, startInput.value);
        const newEnd = buildIso(endedAt, endInput.value);
        const duration = Math.round((new Date(newEnd) - new Date(newStart)) / 1000);
        if (duration <= 0) { await refresh(); return; }
        try {
          await updateTimeEntry(entryId, { startedAt: newStart, endedAt: newEnd, durationSeconds: duration });
          await refresh();
        } catch {
          await refresh();
        }
      }, 100);
    }

    startInput.addEventListener("blur", scheduleSave);
    endInput.addEventListener("blur", scheduleSave);

    [startInput, endInput].forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") inp.blur();
        if (e.key === "Escape") refresh();
      });
    });

    span.textContent = "";
    span.classList.add("entry-card__editing");
    span.appendChild(wrap);
    startInput.focus();
  }

  setupInlineEditing();

  // Initial load
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
