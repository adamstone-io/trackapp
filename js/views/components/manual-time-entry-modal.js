export function createManualTimeEntryModal({ onSave } = {}) {
    let root = null;
    let backdrop = null;

    let titleInput = null;
    let startInput = null;
    let endInput = null;

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
        // value like "2026-01-18T09:30"
        if (!value) return null;

        const [datePart, timePart] = value.split("T");
        if (!datePart || !timePart) return null;

        const [y, m, d] = datePart.split("-").map(Number);
        const [hh, mm] = timePart.split(":").map(Number);

        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

        return new Date(y, m - 1, d, hh, mm, 0, 0); // local time
    }

    function create() {
        backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop hidden";

        root = document.createElement("div");
        root.className = "modal modal--page modal--top hidden";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-labelledby", "manual-entry-title");

        root.innerHTML = `
            <div class="modal-content">
                <h2 id="manual-entry-title">Add manual time entry</h2>

                <label for="manual-title">Task title</label>
                <input id="manual-title" type="text" placeholder="e.g. Write proposal" />

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

        titleInput = root.querySelector("#manual-title");
        startInput = root.querySelector("[data-start]");
        endInput = root.querySelector("[data-end]");

        root.querySelector("[data-cancel]").addEventListener("click", close);
        root.querySelector("[data-save]").addEventListener("click", handleSave);
        backdrop.addEventListener("click", close);
        document.addEventListener("keydown", handleEscape);
    }

    function open() {
        if (!root) create();

        backdrop.classList.remove("hidden");
        root.classList.remove("hidden");
        document.body.classList.add("modal-open");

        const now = new Date();
        endInput.value = toLocalDateTimeValue(now);

        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
        startInput.value = toLocalDateTimeValue(thirtyMinAgo);

        titleInput.focus();
    }

    function close() {
        backdrop.classList.add("hidden");
        root.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    function resetForm() {
        if (titleInput) titleInput.value = "";
    }

    function handleSave() {
        const title = titleInput.value.trim();
        if (!title) {
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

        onSave?.({
            title,
            startedAt: startDate.toISOString(),
            endedAt: endDate.toISOString(),
        });
        resetForm();
        close();
    }

    function handleEscape(event) {
        if (event.key === "Escape") close();
    }

    function dispose() {
        document.removeEventListener("keydown", handleEscape);
        backdrop?.remove();
        root?.remove();

        backdrop = null;
        root = null;
        titleInput = null;
        startInput = null;
        endInput = null;
    }

    return {
        open,
        close,
        dispose,
    };
}