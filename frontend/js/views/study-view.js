// views/study-view.js
import { byId } from "../ui/ui-core.js";
import { studyIds } from "../ui/study-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";

// Store dropdown menus for cleanup
const dropdownMenus = new Map();

export class StudyView {
  /**
   * Render the list of study items.
   * @param {StudyItem[]} studyItems
   * @param {Object} callbacks
   * @param {Function} callbacks.onLogStudy - Callback when log button clicked
   * @param {Function} callbacks.onEdit - Callback when edit button clicked
   * @param {Function} callbacks.onDelete - Callback when delete button clicked
   * @param {Function} callbacks.onArchive - Callback when archive/restore button clicked
   * @param {Function} callbacks.onConvertToReview - Callback when convert to review clicked
   * @param {Function} callbacks.onNotesUpdate - Callback when notes are updated
   * @param {boolean} showArchived - Whether showing archived items
   */
  static renderList(
    studyItems,
    { onLogStudy, onEdit, onDelete, onArchive, onConvertToReview, onNotesUpdate },
    showArchived = false,
  ) {
    const listEl = byId(studyIds.studyList);
    const emptyEl = byId(studyIds.studyListEmpty);

    // Clean up existing dropdown menus
    dropdownMenus.forEach((menu) => menu.dispose());
    dropdownMenus.clear();

    if (!studyItems || studyItems.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      emptyEl.textContent = showArchived
        ? "No archived study items."
        : "No study items yet. Convert prime items or create one from the menu.";
      return;
    }

    emptyEl.style.display = "none";

    // Sort by least recently studied first (unstudied items at top)
    const sorted = [...studyItems].sort((a, b) => {
      const aLast = a.getLastStudyDate()?.getTime() ?? 0;
      const bLast = b.getLastStudyDate()?.getTime() ?? 0;
      if (aLast !== bLast) return aLast - bLast;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    listEl.innerHTML = sorted
      .map((item) => this.renderStudyItem(item, showArchived))
      .join("");

    // Attach event listeners
    sorted.forEach((item) => {
      const logBtn = byId(`log-study-${item.id}`);
      const menuBtn = byId(`menu-study-${item.id}`);
      const notesToggle = byId(`notes-toggle-${item.id}`);
      const notesSection = byId(`notes-section-${item.id}`);
      const notesTextarea = byId(`notes-textarea-${item.id}`);
      const cipherToggle = byId(`cipher-toggle-${item.id}`);
      const cipherSection = byId(`cipher-section-${item.id}`);

      if (logBtn) {
        logBtn.addEventListener("click", () => onLogStudy(item));
      }

      // Notes toggle
      if (notesToggle && notesSection && notesTextarea) {
        notesToggle.addEventListener("click", () => {
          const isHidden = notesSection.classList.contains("hidden");
          notesSection.classList.toggle("hidden");
          notesToggle.classList.toggle("study-item__notes-btn--active", isHidden);
          if (isHidden) {
            notesTextarea.focus();
          }
        });

        // Auto-save notes on blur
        let notesTimer = null;
        notesTextarea.addEventListener("input", () => {
          clearTimeout(notesTimer);
          notesTimer = setTimeout(() => {
            onNotesUpdate(item, notesTextarea.value);
          }, 800);
        });

        notesTextarea.addEventListener("blur", () => {
          clearTimeout(notesTimer);
          onNotesUpdate(item, notesTextarea.value);
        });
      }

      // Cipher toggle
      if (cipherToggle && cipherSection) {
        cipherToggle.addEventListener("click", () => {
          const isHidden = cipherSection.classList.contains("hidden");
          cipherSection.classList.toggle("hidden");
          cipherToggle.classList.toggle("study-item__cipher-btn--active", isHidden);

          // Re-generate cipher text from current notes (may have been edited)
          if (isHidden) {
            const currentNotes = notesTextarea ? notesTextarea.value : (item.notes || "");
            const cipherPre = cipherSection.querySelector(".study-item__cipher-text");
            if (cipherPre) {
              cipherPre.textContent = StudyView.cipherTextRaw(currentNotes);
            }
          }
        });
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
              {
                label: "Convert to Review",
                onSelect: () => onConvertToReview(item),
              },
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
   * Render a single study item card.
   * @param {StudyItem} item
   * @param {boolean} showArchived - Whether this is in archived view
   */
  static renderStudyItem(item, showArchived = false) {
    const totalCount = item.getTotalCount();
    const weekCount = item.getThisWeekCount();
    const monthCount = item.getThisMonthCount();
    const firstStudiedText = item.getFirstStudiedTimeAgo();
    const lastStudyText = item.getLastStudyTimeAgo();

    return `
      <div class="study-item" data-id="${item.id}">
        <div class="study-item__header">
          <div class="study-item__header-content">
            <h3 class="study-item__title">${this.escapeHtml(item.title)}</h3>
            ${
              item.category
                ? `<span class="study-item__category">${this.escapeHtml(this.capitalize(item.category))}</span>`
                : ""
            }
            ${
              item.description
                ? `<p class="study-item__description">${this.escapeHtml(item.description)}</p>`
                : ""
            }
          </div>
          <button
            id="menu-study-${item.id}"
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

        <div class="study-item__footer">
          <div class="study-item__stats">
            <div class="study-stat">
              <span class="study-stat__label">Total</span>
              <span class="study-stat__value">${totalCount}</span>
            </div>
            <div class="study-stat">
              <span class="study-stat__label">This Week</span>
              <span class="study-stat__value">${weekCount}</span>
            </div>
            <div class="study-stat">
              <span class="study-stat__label">This Month</span>
              <span class="study-stat__value">${monthCount}</span>
            </div>
            <div class="study-stat">
              <span class="study-stat__label">First Studied</span>
              <span class="study-stat__value">${firstStudiedText}</span>
            </div>
            <div class="study-stat">
              <span class="study-stat__label">Last Study</span>
              <span class="study-stat__value">${lastStudyText}</span>
            </div>
          </div>
          
          ${
            !showArchived
              ? `<div class="study-item__actions">
                  <button
                    id="notes-toggle-${item.id}"
                    class="btn btn--outline study-item__notes-btn"
                    type="button"
                  >
                    Notes
                  </button>
                  <button
                    id="cipher-toggle-${item.id}"
                    class="btn btn--outline study-item__cipher-btn"
                    type="button"
                  >
                    Cipher
                  </button>
                  <button 
                    id="log-study-${item.id}"
                    class="btn btn--primary study-item__log-btn"
                    type="button"
                  >
                    Log Study
                  </button>
                </div>`
              : ""
          }
        </div>

        <div id="notes-section-${item.id}" class="study-item__notes hidden">
          <textarea
            id="notes-textarea-${item.id}"
            class="study-item__notes-textarea"
            placeholder="Add study notes..."
            rows="4"
          >${this.escapeHtml(item.notes || "")}</textarea>
        </div>

        <div id="cipher-section-${item.id}" class="study-item__cipher hidden">
          <pre class="study-item__cipher-text">${this.cipherText(item.notes || "")}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Open the modal for creating a new study item.
   */
  static openForCreate() {
    const modal = byId(studyIds.studyModal);
    const title = byId(studyIds.studyModalTitle);
    const titleInput = byId(studyIds.studyTitle);
    const categoryInput = byId(studyIds.studyCategory);
    const descInput = byId(studyIds.studyDescription);
    const notesInput = byId(studyIds.studyNotes);

    title.textContent = "Add Study Item";
    titleInput.value = "";
    categoryInput.value = "";
    descInput.value = "";
    notesInput.value = "";

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  /**
   * Open the modal for editing an existing study item.
   * @param {StudyItem} item
   */
  static openForEdit(item) {
    const modal = byId(studyIds.studyModal);
    const title = byId(studyIds.studyModalTitle);
    const titleInput = byId(studyIds.studyTitle);
    const categoryInput = byId(studyIds.studyCategory);
    const descInput = byId(studyIds.studyDescription);
    const notesInput = byId(studyIds.studyNotes);

    title.textContent = "Edit Study Item";
    titleInput.value = item.title;
    categoryInput.value = item.category || "";
    descInput.value = item.description;
    notesInput.value = item.notes || "";

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  /**
   * Close the modal.
   */
  static close() {
    const modal = byId(studyIds.studyModal);
    modal.classList.add("hidden");
  }

  /**
   * Read form values from the modal.
   */
  static readFormData() {
    const titleInput = byId(studyIds.studyTitle);
    const categoryInput = byId(studyIds.studyCategory);
    const descInput = byId(studyIds.studyDescription);
    const notesInput = byId(studyIds.studyNotes);

    return {
      title: titleInput.value.trim(),
      category: categoryInput.value.trim(),
      description: descInput.value.trim(),
      notes: notesInput.value,
    };
  }

  /**
   * Bind modal form events.
   * @param {Object} callbacks
   * @param {Function} callbacks.onSave
   * @param {Function} callbacks.onCancel
   */
  static bind({ onSave, onCancel }) {
    const form = byId(studyIds.studyForm);
    const cancelBtn = byId(studyIds.studyCancelBtn);

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

  /**
   * Generate cipher text from notes (HTML-escaped for use in templates).
   * Every word is replaced with its first letter, except every 4th word
   * which is kept intact. Punctuation is preserved.
   */
  static cipherText(text) {
    return this.escapeHtml(this.cipherTextRaw(text));
  }

  /**
   * Generate raw cipher text (not HTML-escaped, for setting via textContent).
   */
  static cipherTextRaw(text) {
    if (!text || !text.trim()) return "";

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s*/);
    const output = [];

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;

      // Split into words and punctuation
      const tokens = sentence.match(/\b\w+\b|[^\w\s]/g) || [];
      const processed = [];
      let wordCount = 0;

      for (const token of tokens) {
        if (/^\w+$/.test(token)) {
          wordCount++;
          if (wordCount % 4 === 0) {
            processed.push(token); // Keep every 4th word
          } else {
            processed.push(token[0]); // First letter only
          }
        } else {
          processed.push(token); // Keep punctuation
        }
      }

      output.push(processed.join(" "));
    }

    return output.join("\n");
  }
}
