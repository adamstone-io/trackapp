// views/review-view.js
import { byId } from "../ui/ui-core.js";
import { reviewIds } from "../ui/review-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";

// Store dropdown menus for cleanup
const dropdownMenus = new Map();

export class ReviewView {
  /**
   * Render the list of review items.
   * @param {ReviewItem[]} reviewItems
   * @param {Function} onLogReview - Callback when log button clicked
   * @param {Function} onEdit - Callback when edit button clicked
   * @param {Function} onDelete - Callback when delete button clicked
   * @param {Function} onArchive - Callback when archive button clicked
   * @param {boolean} showArchived - Whether showing archived items
   */
  static renderList(
    reviewItems,
    { onLogReview, onEdit, onDelete, onArchive, onReactivateStudy },
    showArchived = false,
  ) {
    const listEl = byId(reviewIds.reviewList);
    const emptyEl = byId(reviewIds.reviewListEmpty);

    // Clean up existing dropdown menus
    dropdownMenus.forEach((menu) => menu.dispose());
    dropdownMenus.clear();

    if (!reviewItems || reviewItems.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      emptyEl.textContent = showArchived
        ? "No archived review items."
        : 'No review items yet. Click "Add Review Item" to get started.';
      return;
    }

    emptyEl.style.display = "none";

    // Sort by least recently reviewed first (unreviewed items at top)
    const sorted = [...reviewItems].sort((a, b) => {
      const aLast = a.getLastReviewDate()?.getTime() ?? 0;
      const bLast = b.getLastReviewDate()?.getTime() ?? 0;
      if (aLast !== bLast) return aLast - bLast;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    listEl.innerHTML = sorted
      .map((item) => this.renderReviewItem(item, showArchived))
      .join("");

    // Attach event listeners
    sorted.forEach((item) => {
      const logBtn = byId(`log-review-${item.id}`);
      const menuBtn = byId(`menu-review-${item.id}`);

      if (logBtn) {
        logBtn.addEventListener("click", () => onLogReview(item));
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
              ...(item.sourceStudyItemId
                ? [
                    {
                      label: "Reactivate Study",
                      onSelect: () => onReactivateStudy(item),
                    },
                  ]
                : []),
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
   * Render a single review item card.
   * @param {ReviewItem} item
   * @param {boolean} showArchived - Whether this is in archived view
   */
  static renderReviewItem(item, showArchived = false) {
    const totalCount = item.getTotalCount();
    const todayCount = item.getTodayCount();
    const weekCount = item.getThisWeekCount();
    const monthCount = item.getThisMonthCount();
    const firstStudiedText = item.getFirstStudiedTimeAgo();
    const lastReviewText = item.getLastReviewTimeAgo();

    return `
      <div class="review-item" data-id="${item.id}">
        <div class="review-item__header">
          <div class="review-item__header-content">
            <h3 class="review-item__title">${this.escapeHtml(item.title)}</h3>
            ${
              item.category
                ? `<span class="review-item__category">${this.escapeHtml(this.capitalize(item.category))}</span>`
                : ""
            }
            ${
              item.description
                ? `<p class="review-item__description">${this.escapeHtml(item.description)}</p>`
                : ""
            }
          </div>
          <button
            id="menu-review-${item.id}"
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

        <div class="review-item__footer">
          <div class="review-item__stats">
            <div class="review-stat">
              <span class="review-stat__label">Total</span>
              <span class="review-stat__value">${totalCount}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">Today</span>
              <span class="review-stat__value">${todayCount}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">This Week</span>
              <span class="review-stat__value">${weekCount}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">This Month</span>
              <span class="review-stat__value">${monthCount}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">First Studied</span>
              <span class="review-stat__value">${firstStudiedText}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">Last Review</span>
              <span class="review-stat__value">${lastReviewText}</span>
            </div>
          </div>
          
          ${
            !showArchived
              ? `<button 
                  id="log-review-${item.id}"
                  class="btn btn--primary review-item__log-btn"
                  type="button"
                >
                  Log Review
                </button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Open the modal for creating a new review item.
   */
  static openForCreate() {
    const modal = byId(reviewIds.reviewModal);
    const title = byId(reviewIds.reviewModalTitle);
    const titleInput = byId(reviewIds.reviewTitle);
    const categoryInput = byId(reviewIds.reviewCategory);
    const descInput = byId(reviewIds.reviewDescription);

    title.textContent = "Add Review Item";
    titleInput.value = "";
    categoryInput.value = "";
    descInput.value = "";

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  /**
   * Open the modal for editing an existing review item.
   * @param {ReviewItem} item
   */
  static openForEdit(item) {
    const modal = byId(reviewIds.reviewModal);
    const title = byId(reviewIds.reviewModalTitle);
    const titleInput = byId(reviewIds.reviewTitle);
    const categoryInput = byId(reviewIds.reviewCategory);
    const descInput = byId(reviewIds.reviewDescription);

    title.textContent = "Edit Review Item";
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
    const modal = byId(reviewIds.reviewModal);
    modal.classList.add("hidden");
  }

  /**
   * Read form values from the modal.
   */
  static readFormData() {
    const titleInput = byId(reviewIds.reviewTitle);
    const categoryInput = byId(reviewIds.reviewCategory);
    const descInput = byId(reviewIds.reviewDescription);

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
    const form = byId(reviewIds.reviewForm);
    const cancelBtn = byId(reviewIds.reviewCancelBtn);

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

  /**
   * Capitalize first letter of a string.
   */
  static capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
