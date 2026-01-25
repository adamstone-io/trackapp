// views/prime-view.js
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";

// Store dropdown menus for cleanup
const dropdownMenus = new Map();

export class PrimeView {
  /**
   * Render the list of prime items.
   * @param {PrimeItem[]} primeItems
   * @param {Function} onLogPrime - Callback when log button clicked
   * @param {Function} onEdit - Callback when edit button clicked
   * @param {Function} onDelete - Callback when delete button clicked
   * @param {Function} onArchive - Callback when archive button clicked
   * @param {boolean} showArchived - Whether showing archived items
   */
  static renderList(
    primeItems,
    { onLogPrime, onEdit, onDelete, onArchive },
    showArchived = false,
  ) {
    const listEl = byId(primeIds.primeList);
    const emptyEl = byId(primeIds.primeListEmpty);

    // Clean up existing dropdown menus
    dropdownMenus.forEach((menu) => menu.dispose());
    dropdownMenus.clear();

    if (!primeItems || primeItems.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      emptyEl.textContent = showArchived
        ? "No archived prime items."
        : 'No prime items yet. Click "Add Prime Item" to get started.';
      return;
    }

    emptyEl.style.display = "none";

    // Sort by least recently primed first (unprimed items at top)
    // This ensures that when you log a prime, it moves to the end
    const sorted = [...primeItems].sort((a, b) => {
      const aLast = a.getLastPrimeDate()?.getTime() ?? 0;
      const bLast = b.getLastPrimeDate()?.getTime() ?? 0;
      if (aLast !== bLast) return aLast - bLast; // Least recent first (reversed from before)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    listEl.innerHTML = sorted
      .map((item) => this.renderPrimeItem(item, showArchived))
      .join("");

    // Attach event listeners
    sorted.forEach((item) => {
      const logBtn = byId(`log-prime-${item.id}`);
      const menuBtn = byId(`menu-prime-${item.id}`);

      if (logBtn) {
        logBtn.addEventListener("click", () => onLogPrime(item));
      }

      if (menuBtn) {
        // Create dropdown menu items
        const menuItems = showArchived
          ? [
              { label: "Restore", onSelect: () => onArchive(item) },
              { label: "Edit", onSelect: () => onEdit(item) },
              { label: "Delete", onSelect: () => onDelete(item) },
            ]
          : [
              { label: "Archive", onSelect: () => onArchive(item) },
              { label: "Edit", onSelect: () => onEdit(item) },
              { label: "Delete", onSelect: () => onDelete(item) },
            ];

        const menu = createDropdownMenu({ items: menuItems });
        menu.attachTo(menuBtn);
        dropdownMenus.set(item.id, menu);
      }
    });
  }

  /**
   * Render a single prime item card.
   * @param {PrimeItem} item
   * @param {boolean} showArchived - Whether this is in archived view
   */
  static renderPrimeItem(item, showArchived = false) {
    const totalCount = item.getTotalCount();
    const todayCount = item.getTodayCount();
    const weekCount = item.getThisWeekCount();
    const monthCount = item.getThisMonthCount();
    const firstPrimeText = item.getFirstPrimeTimeAgo();
    const lastPrimeText = item.getLastPrimeTimeAgo();

    return `
      <div class="prime-item" data-id="${item.id}">
        <div class="prime-item__header">
          <div class="prime-item__header-content">
            <h3 class="prime-item__title">${this.escapeHtml(item.title)}</h3>
            ${
              item.category
                ? `<span class="prime-item__category">${this.escapeHtml(item.category)}</span>`
                : ""
            }
            ${
              item.description
                ? `<p class="prime-item__description">${this.escapeHtml(item.description)}</p>`
                : ""
            }
          </div>
          <button
            id="menu-prime-${item.id}"
            class="icon-btn"
            aria-label="More options for ${this.escapeHtml(item.title)}"
            type="button"
          >
            <svg
              class="icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </button>
        </div>

        <div class="prime-item__footer">
          <div class="prime-item__stats">
            <div class="prime-stat">
              <span class="prime-stat__label">Total</span>
              <span class="prime-stat__value">${totalCount}</span>
            </div>
            <div class="prime-stat">
              <span class="prime-stat__label">Today</span>
              <span class="prime-stat__value">${todayCount}</span>
            </div>
            <div class="prime-stat">
              <span class="prime-stat__label">This Week</span>
              <span class="prime-stat__value">${weekCount}</span>
            </div>
            <div class="prime-stat">
              <span class="prime-stat__label">This Month</span>
              <span class="prime-stat__value">${monthCount}</span>
            </div>
            <div class="prime-stat">
              <span class="prime-stat__label">First</span>
              <span class="prime-stat__value">${firstPrimeText}</span>
            </div>
            <div class="prime-stat">
              <span class="prime-stat__label">Last</span>
              <span class="prime-stat__value">${lastPrimeText}</span>
            </div>
          </div>
          
          ${
            !showArchived
              ? `<button 
                  id="log-prime-${item.id}"
                  class="btn btn--primary prime-item__log-btn"
                  type="button"
                >
                  Log Prime
                </button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Open the modal for creating a new prime item.
   */
  static openForCreate() {
    const modal = byId(primeIds.primeModal);
    const title = byId(primeIds.primeModalTitle);
    const titleInput = byId(primeIds.primeTitle);
    const categoryInput = byId(primeIds.primeCategory);
    const descInput = byId(primeIds.primeDescription);

    title.textContent = "Add Prime Item";
    titleInput.value = "";
    categoryInput.value = "";
    descInput.value = "";

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  /**
   * Open the modal for editing an existing prime item.
   * @param {PrimeItem} item
   */
  static openForEdit(item) {
    const modal = byId(primeIds.primeModal);
    const title = byId(primeIds.primeModalTitle);
    const titleInput = byId(primeIds.primeTitle);
    const categoryInput = byId(primeIds.primeCategory);
    const descInput = byId(primeIds.primeDescription);

    title.textContent = "Edit Prime Item";
    titleInput.value = item.title;
    categoryInput.value = item.category || "";
    descInput.value = item.description;

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  /**
   * Close the modal.
   */
  static close() {
    const modal = byId(primeIds.primeModal);
    modal.classList.add("hidden");
  }

  /**
   * Read form values from the modal.
   */
  static readFormData() {
    const titleInput = byId(primeIds.primeTitle);
    const categoryInput = byId(primeIds.primeCategory);
    const descInput = byId(primeIds.primeDescription);

    return {
      title: titleInput.value.trim(),
      category: categoryInput.value.trim(),
      description: descInput.value.trim(),
    };
  }

  /**
   * Bind modal form events.
   * @param {Object} callbacks
   * @param {Function} callbacks.onSave
   * @param {Function} callbacks.onCancel
   */
  static bind({ onSave, onCancel }) {
    const form = byId(primeIds.primeForm);
    const cancelBtn = byId(primeIds.primeCancelBtn);

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave();
    };

    const handleCancel = () => {
      onCancel();
    };

    form.addEventListener("submit", handleSubmit);
    cancelBtn.addEventListener("click", handleCancel);

    // Return cleanup function
    return () => {
      form.removeEventListener("submit", handleSubmit);
      cancelBtn.removeEventListener("click", handleCancel);
    };
  }

  /**
   * Escape HTML to prevent XSS.
   */
  static escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
