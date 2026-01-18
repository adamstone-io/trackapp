    // ui/time-entry-modal.js

    export function createTimeEntryModal({ onSave } = {}) {
        let root = null;
        let backdrop = null;

        let headingEl = null;

        let titleInput = null;
        let startInput = null;
        let endInput = null;

        let editingId = null;

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

            if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
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
            startInput = root.querySelector("[data-start]");
            endInput = root.querySelector("[data-end]");

            const cancelBtn = root.querySelector("[data-cancel]");
            const saveBtn = root.querySelector("[data-save]");

            if (!headingEl || !titleInput || !startInput || !endInput || !cancelBtn || !saveBtn) {
                throw new Error("TimeEntryModal: expected elements not found.");
            }

            cancelBtn.addEventListener("click", close);
            saveBtn.addEventListener("click", handleSave);
            backdrop.addEventListener("click", close);
            document.addEventListener("keydown", handleEscape);
        }

        function openBase() {
            if (!root || !backdrop) return;

            backdrop.classList.remove("hidden");
            root.classList.remove("hidden");
            document.body.classList.add("modal-open");

            if (titleInput) titleInput.focus();
        }

        function openCreate() {
            ensureCreated();

            editingId = null;
            if (headingEl) headingEl.textContent = "Add time entry";

            const now = new Date();
            const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

            titleInput.value = "";
            startInput.value = toLocalDateTimeValue(thirtyMinAgo);
            endInput.value = toLocalDateTimeValue(now);

            openBase();
        }

        function openEdit(entry) {
            ensureCreated();

            editingId = entry.id;
            if (headingEl) headingEl.textContent = "Edit time entry";

            // supports either `taskTitle` or older `title`
            titleInput.value = entry.taskTitle ?? entry.title ?? "";
            startInput.value = toLocalDateTimeValue(new Date(entry.startedAt));
            endInput.value = toLocalDateTimeValue(new Date(entry.endedAt));

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
            editingId = null;
        }

        function handleSave() {
            if (!titleInput || !startInput || !endInput) return;

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

            if (typeof onSave === "function") {
                onSave({
                    id: editingId, // null => create, string => update
                    taskTitle,
                    startedAt: startDate.toISOString(),
                    endedAt: endDate.toISOString(),
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
            startInput = null;
            endInput = null;
            editingId = null;
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
