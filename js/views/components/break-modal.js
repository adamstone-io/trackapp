// js/views/components/break-modal.js

export function createBreakModal({ onSave } = {}) {
  let root = null;
  let backdrop = null;
  let nameInput = null;
  let headingEl = null;

  function ensureCreated() {
    if (root) return;

    backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop hidden";

    root = document.createElement("div");
    root.className = "modal modal--page modal--top hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "break-modal-title");

    root.innerHTML = `
      <div class="modal-content">
        <h2 id="break-modal-title">Log break</h2>

        <label for="break-name">Break name</label>
        <input id="break-name" type="text" placeholder="Coffee, stretch, etc." />

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-cancel>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" data-save>
            Save break
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(root);

    headingEl = root.querySelector("#break-modal-title");
    nameInput = root.querySelector("#break-name");

    const cancelBtn = root.querySelector("[data-cancel]");
    const saveBtn = root.querySelector("[data-save]");

    if (!headingEl || !nameInput || !cancelBtn || !saveBtn) {
      throw new Error("BreakModal: expected elements not found.");
    }

    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", handleSave);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", handleEscape);
  }

  function open() {
    ensureCreated();

    if (headingEl) headingEl.textContent = "Log break";
    if (nameInput) {
      nameInput.value = "";
      nameInput.focus();
    }

    if (backdrop) backdrop.classList.remove("hidden");
    if (root) root.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function close() {
    if (backdrop) backdrop.classList.add("hidden");
    if (root) root.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function handleSave() {
    if (!nameInput) return;
    const label = nameInput.value.trim();
    if (!label) {
      alert("Break name is required.");
      return;
    }
    if (typeof onSave === "function") {
      onSave({ label });
    }
    close();
  }

  function handleEscape(event) {
    if (event.key === "Escape") close();
  }

  function dispose() {
    document.removeEventListener("keydown", handleEscape);
    if (backdrop) backdrop.remove();
    if (root) root.remove();
    root = null;
    backdrop = null;
    nameInput = null;
    headingEl = null;
  }

  return {
    open,
    close,
    dispose,
  };
}
