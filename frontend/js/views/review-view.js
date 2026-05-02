import { byId } from "../ui/ui-core.js";
import { reviewIds } from "../ui/review-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";
import { renderNotesToHtml } from "../utils/notes-renderer.js";
import { highlightNotesCodeBlocks } from "../utils/notes-syntax-highlight.js";

const dropdownMenus = new Map();
let renderedItemIds = new Set();
let lastRenderCount = 0;

export class ReviewView {
  static resetRenderState() {
    renderedItemIds.clear();
    lastRenderCount = 0;
    const listEl = byId(reviewIds.reviewList);
    if (listEl) listEl.innerHTML = "";
  }

  static renderList(
    reviewItems,
    {
      onLogReview,
      onEdit,
      onDelete,
      onArchive,
      onConvertToStudy,
      onConvertToPriming,
    },
    showArchived = false,
    { showSentinel = false } = {},
  ) {
    const listEl = byId(reviewIds.reviewList);
    const emptyEl = byId(reviewIds.reviewListEmpty);

    if (!reviewItems || reviewItems.length === 0) {
      dropdownMenus.forEach((menu) => menu.dispose());
      dropdownMenus.clear();
      renderedItemIds.clear();
      lastRenderCount = 0;
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      emptyEl.textContent = showArchived
        ? "No archived review items."
        : 'No review items yet. Click "Add Review Item" to get started.';
      return;
    }

    emptyEl.style.display = "none";

    const sorted = [...reviewItems].sort((a, b) => {
      const aLast = a.lastReviewedAt
        ? new Date(a.lastReviewedAt).getTime()
        : Infinity;
      const bLast = b.lastReviewedAt
        ? new Date(b.lastReviewedAt).getTime()
        : Infinity;
      if (aLast !== bLast) return aLast - bLast;

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
      return aCreated - bCreated;
    });

    const callbacks = { onLogReview, onEdit, onDelete, onArchive, onConvertToStudy, onConvertToPriming };
    const currentRenderCount = sorted.length;
    const canIncrement = currentRenderCount > lastRenderCount;

    if (canIncrement) {
      const newItems = sorted.slice(lastRenderCount);
      const oldSentinel = document.getElementById(reviewIds.reviewListSentinel);
      if (oldSentinel) oldSentinel.remove();

      newItems.forEach((item) => {
        listEl.insertAdjacentHTML("beforeend", this.renderReviewItem(item, showArchived));
        renderedItemIds.add(item.id);
        this.attachItemListeners(item, callbacks, showArchived);
      });
    } else {
      dropdownMenus.forEach((menu) => menu.dispose());
      dropdownMenus.clear();
      renderedItemIds.clear();

      listEl.innerHTML = sorted
        .map((item) => this.renderReviewItem(item, showArchived))
        .join("");

      sorted.forEach((item) => {
        renderedItemIds.add(item.id);
        this.attachItemListeners(item, callbacks, showArchived);
      });
    }

    if (showSentinel) {
      listEl.insertAdjacentHTML(
        "beforeend",
        `<div id="${reviewIds.reviewListSentinel}" class="review-list-sentinel"></div>`,
      );
    }

    highlightNotesCodeBlocks(listEl);
    lastRenderCount = currentRenderCount;
  }

  static attachItemListeners(
    item,
    { onLogReview, onEdit, onDelete, onArchive, onConvertToStudy, onConvertToPriming },
    showArchived,
  ) {
    const logBtn = byId(`log-review-${item.id}`);
    const menuBtn = byId(`menu-review-${item.id}`);
    const notesToggle = byId(`notes-toggle-${item.id}`);
    const notesSection = byId(`notes-section-${item.id}`);

    if (logBtn) logBtn.addEventListener("click", () => onLogReview(item));

    if (notesToggle && notesSection) {
      notesToggle.addEventListener("click", () => {
        const isHidden = notesSection.classList.contains("hidden");
        notesSection.classList.toggle("hidden");
        notesToggle.classList.toggle(
          "review-item__notes-btn--active",
          isHidden,
        );
      });
    }

    if (menuBtn) {
      const menuItems = showArchived
        ? [
            { label: "Restore", onSelect: () => onArchive(item) },
            { label: "Edit", onSelect: () => onEdit(item) },
            { label: "Delete", onSelect: () => onDelete(item) },
          ]
        : [
            {
              label: "Convert to Study",
              onSelect: () => onConvertToStudy(item),
            },
            {
              label: "Convert to Priming",
              onSelect: () => onConvertToPriming(item),
            },
            { label: "Archive", onSelect: () => onArchive(item) },
            { label: "Edit", onSelect: () => onEdit(item) },
            { label: "Delete", onSelect: () => onDelete(item) },
          ];

      const menu = createDropdownMenu({ items: menuItems });
      menu.attachTo(menuBtn);
      dropdownMenus.set(item.id, menu);
    }
  }

  static renderReviewItem(item, showArchived = false) {
    const totalCount = item.getCurrentModeCount();
    const todayCount = item.getTodayCount();
    const weekCount = item.getWeekCount();
    const monthCount = item.getMonthCount();
    const firstReviewText = item.getFirstReviewedTimeAgo();
    const lastReviewText = item.getLastReviewedTimeAgo();

    return `
      <div class="review-item" data-id="${item.id}">
        <div class="review-item__header">
          <div class="review-item__header-content">
            <h3 class="review-item__title">${this.escapeHtml(item.prompt)}</h3>
            ${
              item.category
                ? `<span class="review-item__category">${this.escapeHtml(
                    this.capitalize(item.category),
                  )}</span>`
                : ""
            }
          </div>
          <button
            id="menu-review-${item.id}"
            class="icon-btn"
            aria-label="More options for ${this.escapeHtml(item.prompt)}"
            type="button"
          >
            <svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </button>
        </div>
        ${
          item.imageUrl
            ? `
        <div class="review-item__image-row">
          <img class="review-item__image" src="${item.imageUrl}" alt="" />
        </div>
      `
            : ""
        }
        <div class="review-item__footer">
          <div class="review-item__stats">
            <div class="review-stat">
              <span class="review-stat__label">Total</span>
              <span class="review-stat__value">${totalCount}</span>
            </div>
            <div class="review-stat stat--hide-mobile">
              <span class="review-stat__label">Today</span>
              <span class="review-stat__value">${todayCount}</span>
            </div>
            <div class="review-stat stat--hide-mobile">
              <span class="review-stat__label">This Week</span>
              <span class="review-stat__value">${weekCount}</span>
            </div>
            <div class="review-stat stat--hide-mobile">
              <span class="review-stat__label">This Month</span>
              <span class="review-stat__value">${monthCount}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">First Review</span>
              <span class="review-stat__value">${firstReviewText}</span>
            </div>
            <div class="review-stat">
              <span class="review-stat__label">Last Review</span>
              <span class="review-stat__value">${lastReviewText}</span>
            </div>
          </div>

          ${
            !showArchived
              ? `<div class="review-item__actions">
                  <button
                    id="notes-toggle-${item.id}"
                    class="btn btn--outline review-item__notes-btn"
                    type="button"
                  >
                    Notes
                  </button>
                  <button
                    id="log-review-${item.id}"
                    class="btn btn--primary review-item__log-btn"
                    type="button"
                  >
                    Log Review
                  </button>
                </div>`
              : ""
          }
        </div>

        <div id="notes-section-${item.id}" class="review-item__notes hidden">
          ${
            item.noteImageUrl
              ? `<img
                  class="review-item__note-image"
                  src="${item.noteImageUrl}"
                  alt="Note image"
                />`
              : renderNotesToHtml(item.notes || "") ||
                `<p class="notes-rendered__empty">No notes yet. Use Edit in the menu to add some.</p>`
          }
        </div>
      </div>
    `;
  }

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

  static openForEdit(item) {
    const modal = byId(reviewIds.reviewModal);
    const title = byId(reviewIds.reviewModalTitle);
    const titleInput = byId(reviewIds.reviewTitle);
    const categoryInput = byId(reviewIds.reviewCategory);
    const notesInput = byId(reviewIds.reviewNotes);

    title.textContent = "Edit Review Item";
    titleInput.value = item.prompt;
    categoryInput.value = item.category || "";
    if (notesInput) notesInput.value = item.notes || "";

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  static close() {
    const modal = byId(reviewIds.reviewModal);
    modal.classList.add("hidden");
  }

  static readFormData() {
    const titleInput = byId(reviewIds.reviewTitle);
    const categoryInput = byId(reviewIds.reviewCategory);
    const notesInput = byId(reviewIds.reviewNotes);

    return {
      prompt: titleInput.value.trim(),
      category: categoryInput.value.trim(),
      notes: notesInput?.value.trim() ?? "",
    };
  }

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

    return () => {
      form.removeEventListener("submit", handleSubmit);
      cancelBtn.removeEventListener("click", handleCancel);
    };
  }

  static escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  static capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
