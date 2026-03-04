// views/study-view.js
import { byId } from "../ui/ui-core.js";
import { studyIds } from "../ui/study-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";

// Store dropdown menus for cleanup
const dropdownMenus = new Map();

export class StudyView {
  static renderList(
    studyItems,
    {
      onLogStudy,
      onEdit,
      onDelete,
      onArchive,
      onConvertToReview,
      onConvertToPriming,
      onNotesUpdate,
    },
    showArchived = false,
  ) {
    const listEl = byId(studyIds.studyList);
    const emptyEl = byId(studyIds.studyListEmpty);

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

    const sorted = [...studyItems].sort((a, b) => {
      const aLast = a.lastStudiedAt
        ? new Date(a.lastStudiedAt).getTime()
        : Infinity;
      const bLast = b.lastStudiedAt
        ? new Date(b.lastStudiedAt).getTime()
        : Infinity;
      if (aLast !== bLast) return aLast - bLast;

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
      return aCreated - bCreated;
    });

    listEl.innerHTML = sorted
      .map((item) => this.renderStudyItem(item, showArchived))
      .join("");

    sorted.forEach((item) => {
      const logBtn = byId(`log-study-${item.id}`);
      const menuBtn = byId(`menu-study-${item.id}`);
      const notesToggle = byId(`notes-toggle-${item.id}`);
      const notesSection = byId(`notes-section-${item.id}`);
      const notesTextarea = document.getElementById(`notes-textarea-${item.id}`);
      const cipherToggle = byId(`cipher-toggle-${item.id}`);
      const cipherSection = byId(`cipher-section-${item.id}`);
      if (logBtn) logBtn.addEventListener("click", () => onLogStudy(item));

      if (notesToggle && notesSection) {
        notesToggle.addEventListener("click", () => {
          const isHidden = notesSection.classList.contains("hidden");
          notesSection.classList.toggle("hidden");
          notesToggle.classList.toggle(
            "study-item__notes-btn--active",
            isHidden,
          );
          if (isHidden && notesTextarea) notesTextarea.focus();
        });

        if (notesTextarea) {
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
      }

      if (cipherToggle && cipherSection) {
        cipherToggle.addEventListener("click", () => {
          const isHidden = cipherSection.classList.contains("hidden");
          cipherSection.classList.toggle("hidden");
          cipherToggle.classList.toggle(
            "study-item__cipher-btn--active",
            isHidden,
          );

          if (isHidden) {
            const currentNotes = notesTextarea
              ? notesTextarea.value
              : item.notes || "";
            const cipherPre = cipherSection.querySelector(
              ".study-item__cipher-text",
            );
            if (cipherPre) {
              cipherPre.textContent = StudyView.cipherTextRaw(currentNotes);
            }
          }
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
                label: "Convert to Priming",
                onSelect: () => onConvertToPriming(item),
              },
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

  static renderStudyItem(item, showArchived = false) {
    const totalCount = item.getCurrentModeCount();
    const weekCount = item.getWeekCount();
    const monthCount = item.getMonthCount();
    const firstStudiedText = item.getFirstStudiedTimeAgo();
    const lastStudyText = item.getLastStudiedTimeAgo();

    return `
      <div class="study-item" data-id="${item.id}">
        <div class="study-item__header">
          <div class="study-item__header-content">
            <h3 class="study-item__title">${this.escapeHtml(item.prompt)}</h3>
            ${
              item.category
                ? `<span class="study-item__category">${this.escapeHtml(
                    this.capitalize(item.category),
                  )}</span>`
                : ""
            }
            ${
              item.notes
                ? `<p class="study-item__description">${this.escapeHtml(
                    item.notes,
                  )}</p>`
                : ""
            }
          </div>
          <button
            id="menu-study-${item.id}"
            class="icon-btn"
            aria-label="More options for ${this.escapeHtml(item.prompt)}"
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
        ${
          item.imageUrl
            ? `
        <div class="study-item__image-row">
          <img class="study-item__image" src="${item.imageUrl}" alt="" />
        </div>
      `
            : ""
        }
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
          ${
            item.noteImageUrl
              ? `<img
                  class="study-item__note-image"
                  src="${item.noteImageUrl}"
                  alt="Note image"
                />`
              : `<textarea
                  id="notes-textarea-${item.id}"
                  class="study-item__notes-textarea"
                  placeholder="Add study notes..."
                  rows="4"
                >${this.escapeHtml(item.notes || "")}</textarea>`
          }
        </div>

        <div id="cipher-section-${item.id}" class="study-item__cipher hidden">
          <pre class="study-item__cipher-text">${this.cipherText(item.notes || "")}</pre>
        </div>

      </div>
    `;
  }

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

  static openForEdit(item) {
    const modal = byId(studyIds.studyModal);
    const title = byId(studyIds.studyModalTitle);
    const titleInput = byId(studyIds.studyTitle);
    const categoryInput = byId(studyIds.studyCategory);
    const notesInput = byId(studyIds.studyNotes);

    title.textContent = "Edit Study Item";
    titleInput.value = item.prompt;
    categoryInput.value = item.category || "";
    if (notesInput) notesInput.value = item.notes || "";

    StudyView._setupModalImages(item.imageUrl ?? null, item.noteImageUrl ?? null);

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  static readModalImageState() {
    const promptInput = byId(studyIds.modalPromptImageInput);
    const promptPreview = byId(studyIds.modalPromptImagePreview);
    const noteInput = byId(studyIds.modalNoteImageInput);
    const notePreview = byId(studyIds.modalNoteImagePreview);
    return {
      newPromptFile: promptInput?.files?.[0] ?? null,
      removePromptImage: promptPreview?.dataset.pendingRemove === "true",
      newNoteFile: noteInput?.files?.[0] ?? null,
      removeNoteImage: notePreview?.dataset.pendingRemove === "true",
    };
  }

  static _setupModalImages(currentPromptUrl, currentNoteUrl) {
    StudyView._setupModalImageSlot(
      studyIds.modalPromptImagePreview,
      studyIds.modalPromptImagePreviewImg,
      studyIds.modalPromptImageRemoveBtn,
      studyIds.modalPromptImageInput,
      currentPromptUrl,
    );
    StudyView._setupModalImageSlot(
      studyIds.modalNoteImagePreview,
      studyIds.modalNoteImagePreviewImg,
      studyIds.modalNoteImageRemoveBtn,
      studyIds.modalNoteImageInput,
      currentNoteUrl,
    );
  }

  static _setupModalImageSlot(previewId, previewImgId, removeBtnId, inputId, currentUrl) {
    const _replace = (id) => {
      const el = byId(id);
      if (!el) return null;
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      return clone;
    };

    const preview = _replace(previewId);
    const previewImg = byId(previewImgId);
    const removeBtn = _replace(removeBtnId);
    const input = _replace(inputId);

    if (!preview) return;

    delete preview.dataset.pendingRemove;
    if (input) input.value = "";

    const uploadLabel = input?.parentElement;
    const setLabelText = (hasImage) => {
      if (!uploadLabel) return;
      for (const node of uploadLabel.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = hasImage ? " Change Image " : " Upload Image ";
          return;
        }
      }
    };

    if (currentUrl) {
      if (previewImg) previewImg.src = currentUrl;
      preview.classList.remove("hidden");
      setLabelText(true);
    } else {
      if (previewImg) previewImg.src = "";
      preview.classList.add("hidden");
      setLabelText(false);
    }

    removeBtn?.addEventListener("click", () => {
      preview.dataset.pendingRemove = "true";
      preview.classList.add("hidden");
      if (previewImg) previewImg.src = "";
      setLabelText(false);
    });

    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        delete preview.dataset.pendingRemove;
        if (previewImg) previewImg.src = URL.createObjectURL(file);
        preview.classList.remove("hidden");
        setLabelText(true);
      }
    });
  }

  static close() {
    const modal = byId(studyIds.studyModal);
    modal.classList.add("hidden");
  }

  static readFormData() {
    const titleInput = byId(studyIds.studyTitle);
    const categoryInput = byId(studyIds.studyCategory);
    const notesInput = byId(studyIds.studyNotes);

    return {
      prompt: titleInput.value.trim(),
      category: categoryInput.value.trim(),
      notes: notesInput?.value ?? "",
    };
  }

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

  static cipherText(text) {
    return this.escapeHtml(this.cipherTextRaw(text));
  }

  static cipherTextRaw(text) {
    if (!text || !text.trim()) return "";
    const sentences = text.split(/(?<=[.!?])\s*/);
    const output = [];

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;

      const tokens = sentence.match(/\b\w+\b|[^\w\s]/g) || [];
      const processed = [];
      let wordCount = 0;

      for (const token of tokens) {
        if (/^\w+$/.test(token)) {
          wordCount++;
          if (wordCount % 4 === 0) {
            processed.push(token);
          } else {
            processed.push(token[0]);
          }
        } else {
          processed.push(token);
        }
      }

      output.push(processed.join(" "));
    }

    return output.join("\n");
  }
}
