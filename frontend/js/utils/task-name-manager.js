/**
 * Manages task-name autocomplete suggestions.
 * Suggestions are sorted by entry count (most-used first) and filtered
 * as the user types.
 */
export class TaskNameManager {
  constructor(inputElement, dropdownElement) {
    this.input = inputElement;
    this.dropdown = dropdownElement;
    this.tasks = []; // [{ title, entryCount }]
    this.selectedIndex = -1;

    this._onInputBound = () => this._handleInput();
    this._onFocusBound = () => this._handleInput();
    this._onKeydownBound = (e) => this._handleKeydown(e);
    this._onDocClickBound = (e) => this._handleDocClick(e);

    this.input.addEventListener("input", this._onInputBound);
    this.input.addEventListener("focus", this._onFocusBound);
    this.input.addEventListener("keydown", this._onKeydownBound);
    document.addEventListener("click", this._onDocClickBound);
  }

  /**
   * Feed task data from the API.
   * @param {Array<{title: string, entry_count: number}>} tasks
   */
  setTasks(tasks = []) {
    const seen = new Map();
    for (const t of tasks) {
      const title = (t.title || "").trim();
      if (!title) continue;
      const count = Number(t.entry_count ?? 0);
      const existing = seen.get(title.toLowerCase()) ?? { title, entryCount: 0 };
      existing.entryCount += Number.isFinite(count) ? count : 0;
      seen.set(title.toLowerCase(), existing);
    }
    this.tasks = [...seen.values()].sort((a, b) => b.entryCount - a.entryCount);

    if (document.activeElement === this.input) {
      this._renderDropdown(this.input.value);
    }
  }

  _getFiltered(query = "") {
    const q = query.trim().toLowerCase();
    if (!q) return this.tasks.slice(0, 5);
    return this.tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 5);
  }

  _handleInput() {
    this.selectedIndex = -1;
    this._renderDropdown(this.input.value);
  }

  _handleKeydown(e) {
    const items = this.dropdown.querySelectorAll(".task-suggestion-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
      this._updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
      this._updateSelection(items);
    } else if (e.key === "Enter" && this.selectedIndex >= 0) {
      e.preventDefault();
      const selected = items[this.selectedIndex];
      if (selected) this._select(selected.dataset.title);
    } else if (e.key === "Escape") {
      this._hide();
    }
  }

  _handleDocClick(e) {
    if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
      this._hide();
    }
  }

  _updateSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle("task-suggestion-item--selected", i === this.selectedIndex);
      if (i === this.selectedIndex) item.scrollIntoView({ block: "nearest" });
    });
  }

  _renderDropdown(query = "") {
    const filtered = this._getFiltered(query);
    if (filtered.length === 0) {
      this._hide();
      return;
    }

    this.dropdown.innerHTML = filtered
      .map(
        ({ title }) => `
        <div class="task-suggestion-item" data-title="${this._escape(title)}">
          <span class="task-suggestion-item__title">${this._escape(title)}</span>
        </div>
      `,
      )
      .join("");

    this.dropdown.classList.remove("hidden");

    this.dropdown.querySelectorAll(".task-suggestion-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent input blur before select fires
        this._select(item.dataset.title);
      });
    });
  }

  _select(title) {
    this.input.value = title;
    this._hide();
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  _hide() {
    this.dropdown.classList.add("hidden");
    this.selectedIndex = -1;
  }

  _escape(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  dispose() {
    this.input.removeEventListener("input", this._onInputBound);
    this.input.removeEventListener("focus", this._onFocusBound);
    this.input.removeEventListener("keydown", this._onKeydownBound);
    document.removeEventListener("click", this._onDocClickBound);
  }
}
