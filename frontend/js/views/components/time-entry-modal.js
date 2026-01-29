// ui/time-entry-modal.js
import { loadProjects } from "../../data/storage.js";

export function createTimeEntryModal({ onSave } = {}) {
  let root = null;
  let backdrop = null;

  let headingEl = null;

  let titleInput = null;
  let projectSelect = null;
  let categorySelect = null;
  let startInput = null;
  let endInput = null;

  let editingId = null;
  let editingTaskId = null;

  function toLocalDateTimeValue(date) {
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function parseLocalDateTime(value) {
    if (!value) return null;

    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return null;

    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);

    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
      return null;
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  function ensureCreated() {
    if (root) return;

    backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop hidden";

    root = document.createElement("div");
    root.className = "modal modal--page modal--top hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "time-entry-modal-title");

    root.innerHTML = `
                <div class="modal-content">
                    <h2 id="time-entry-modal-title">Add time entry</h2>

                    <label for="time-entry-title">Task title</label>
                    <input id="time-entry-title" type="text" placeholder="What'd you work on?" />

                    <label for="time-entry-project">Project</label>
                    <select id="time-entry-project" data-project>
                        <option value="">No project</option>
                    </select>

                    <label for="time-entry-category">Category</label>
                    <select id="time-entry-category" data-category>
                        <option value="Other">Other</option>
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                        <option value="Learning">Learning</option>
                        <option value="Health">Health</option>
                        <option value="Break">Break</option>
                    </select>

                    <div class="time-row">
                        <label class="field">
                            Start time
                            <input type="datetime-local" data-start />
                        </label>

                        <label class="field">
                            End time
                            <input type="datetime-local" data-end />
                        </label>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" data-cancel>
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" data-save>
                            Save
                        </button>
                    </div>
                </div>
            `;

    document.body.appendChild(backdrop);
    document.body.appendChild(root);

    headingEl = root.querySelector("#time-entry-modal-title");
    titleInput = root.querySelector("#time-entry-title");
    projectSelect = root.querySelector("[data-project]");
    startInput = root.querySelector("[data-start]");
    endInput = root.querySelector("[data-end]");
    categorySelect = root.querySelector("[data-category]");

    const cancelBtn = root.querySelector("[data-cancel]");
    const saveBtn = root.querySelector("[data-save]");

    if (
      !headingEl ||
      !titleInput ||
      !projectSelect ||
      !startInput ||
      !endInput ||
      !cancelBtn ||
      !saveBtn
    ) {
      throw new Error("TimeEntryModal: expected elements not found.");
    }

    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", handleSave);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", handleEscape);
  }

  async function populateProjects(selectedProjectId = null) {
    if (!projectSelect) return;

    const allProjects = await loadProjects();
    const projects = allProjects.filter((p) => !p.archived);

    projectSelect.innerHTML =
      `<option value="">No project</option>` +
      projects
        .map(
          (p) =>
            `<option value="${p.id}"${p.id === selectedProjectId ? " selected" : ""}>${escapeHtml(p.name)}</option>`,
        )
        .join("");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function openBase() {
    if (!root || !backdrop) return;

    backdrop.classList.remove("hidden");
    root.classList.remove("hidden");
    document.body.classList.add("modal-open");

    if (titleInput) titleInput.focus();
  }

  async function openCreate() {
    ensureCreated();

    editingId = null;
    editingTaskId = null;
    if (headingEl) headingEl.textContent = "Add time entry";

    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    titleInput.value = "";
    await populateProjects(null);
    startInput.value = toLocalDateTimeValue(thirtyMinAgo);
    endInput.value = toLocalDateTimeValue(now);
    categorySelect.value = "Other";
    openBase();
  }

  async function openEdit(entry) {
    ensureCreated();

    editingId = entry.id;
    editingTaskId = entry.taskId ?? entry.task ?? null;
    if (headingEl) headingEl.textContent = "Edit time entry";

    // supports taskTitle (frontend), task_title (API), or older title
    titleInput.value = entry.taskTitle ?? entry.task_title ?? entry.title ?? "";
    // Populate projects and select the current one if available
    await populateProjects(entry.projectId ?? entry.project ?? null);
    const startedAt = entry.startedAt ?? entry.started_at;
    const endedAt = entry.endedAt ?? entry.ended_at;
    startInput.value = startedAt
      ? toLocalDateTimeValue(new Date(startedAt))
      : "";
    endInput.value = endedAt ? toLocalDateTimeValue(new Date(endedAt)) : "";
    categorySelect.value = entry.category || "Other";
    openBase();
  }

  function close() {
    if (!backdrop || !root) return;

    backdrop.classList.add("hidden");
    root.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function resetForm() {
    if (titleInput) titleInput.value = "";
    if (projectSelect) projectSelect.value = "";
    if (categorySelect) categorySelect.value = "Other";
    editingId = null;
    editingTaskId = null;
  }

  function handleSave() {
    if (!titleInput || !projectSelect || !startInput || !endInput) return;

    const taskTitle = titleInput.value.trim();
    if (!taskTitle) {
      alert("Task title is required.");
      return;
    }

    const startDate = parseLocalDateTime(startInput.value);
    const endDate = parseLocalDateTime(endInput.value);

    if (!startDate || !endDate) {
      alert("Start time and end time are required.");
      return;
    }

    if (endDate <= startDate) {
      alert("End time must be after start time.");
      return;
    }

    const projectId = projectSelect.value || null;

    if (typeof onSave === "function") {
      onSave({
        id: editingId, // null => create, string => update
        taskId: editingTaskId,
        taskTitle,
        projectId,
        startedAt: startDate.toISOString(),
        endedAt: endDate.toISOString(),
        category: categorySelect.value || "Other",
      });
    }

    resetForm();
    close();
  }

  function handleEscape(event) {
    if (event.key === "Escape") close();
  }

  function dispose() {
    document.removeEventListener("keydown", handleEscape);

    if (backdrop) backdrop.remove();
    if (root) root.remove();

    backdrop = null;
    root = null;
    headingEl = null;
    titleInput = null;
    projectSelect = null;
    startInput = null;
    endInput = null;
    editingId = null;
    editingTaskId = null;
  }

  return {
    openCreate,
    openEdit,

    // optional alias so existing code calling `open()` still works:
    open: openCreate,

    close,
    dispose,
  };
}
