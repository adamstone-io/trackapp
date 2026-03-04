// views/prime-view.js
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
import { createDropdownMenu } from "./components/dropdown-menu.js";

const dropdownMenus = new Map();
let renderedItemIds = new Set();
let lastRenderCount = 0;

export class PrimeView {
  static resetRenderState() {
    renderedItemIds.clear();
    lastRenderCount = 0;
    const listEl = byId(primeIds.primeList);
    if (listEl) listEl.innerHTML = "";
  }

  static renderList(
    items,
    {
      onLogPrime,
      onEdit,
      onDelete,
      onArchive,
      onConvertToReview,
      onConvertToStudy,
    },
    showArchived = false,
    {
      limit = null,
      showSentinel = false,
      forceFullRender = false,
      isLoading = false,
    } = {},
  ) {
    const listEl = byId(primeIds.primeList);
    const emptyEl = byId(primeIds.primeListEmpty);
    const loadingEl = byId(primeIds.primeListLoading);

    if (isLoading) {
      listEl.innerHTML = "";
      emptyEl.style.display = "none";
      if (loadingEl) loadingEl.classList.remove("hidden");
      dropdownMenus.forEach((menu) => menu.dispose());
      dropdownMenus.clear();
      renderedItemIds.clear();
      lastRenderCount = 0;
      return;
    }

    if (loadingEl) loadingEl.classList.add("hidden");

    if (!items || items.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      emptyEl.textContent = showArchived
        ? "No archived prime items."
        : "No primes found. Click Add to create your first prime.";
      dropdownMenus.forEach((menu) => menu.dispose());
      dropdownMenus.clear();
      renderedItemIds.clear();
      lastRenderCount = 0;
      return;
    }

    emptyEl.style.display = "none";

    const sorted = [...items];

    const itemsToRender =
      typeof limit === "number" ? sorted.slice(0, limit) : sorted;

    const currentRenderCount = itemsToRender.length;
    const canIncrement =
      !forceFullRender && currentRenderCount > lastRenderCount;

    if (canIncrement) {
      const newItems = itemsToRender.slice(lastRenderCount);

      const oldSentinel = document.getElementById(primeIds.primeListSentinel);
      if (oldSentinel) oldSentinel.remove();

      newItems.forEach((item) => {
        const itemHtml = this.renderPrimeItem(item, showArchived);
        listEl.insertAdjacentHTML("beforeend", itemHtml);
        renderedItemIds.add(item.id);
        this.attachItemListeners(
          item,
          {
            onLogPrime,
            onEdit,
            onDelete,
            onArchive,
            onConvertToReview,
            onConvertToStudy,
          },
          showArchived,
        );
      });

      if (showSentinel) {
        listEl.insertAdjacentHTML(
          "beforeend",
          `<div id="${primeIds.primeListSentinel}" class="prime-list-sentinel"></div>`,
        );
      }
    } else {
      dropdownMenus.forEach((menu) => menu.dispose());
      dropdownMenus.clear();
      renderedItemIds.clear();

      listEl.innerHTML = itemsToRender
        .map((item) => this.renderPrimeItem(item, showArchived))
        .join("");

      if (showSentinel) {
        listEl.insertAdjacentHTML(
          "beforeend",
          `<div id="${primeIds.primeListSentinel}" class="prime-list-sentinel"></div>`,
        );
      }

      itemsToRender.forEach((item) => {
        renderedItemIds.add(item.id);
        this.attachItemListeners(
          item,
          {
            onLogPrime,
            onEdit,
            onDelete,
            onArchive,
            onConvertToReview,
            onConvertToStudy,
          },
          showArchived,
        );
      });
    }

    lastRenderCount = currentRenderCount;
  }

  static renderPrimeItem(item, showArchived = false) {
    const totalCount = item.getCurrentModeCount();
    const todayCount = item.getTodayCount();
    const weekCount = item.getWeekCount();
    const monthCount = item.getMonthCount();
    const firstPrimeText = item.getFirstPrimedTimeAgo();
    const lastPrimeText = item.getLastPrimedTimeAgo();

    return `
      <div class="prime-item" data-id="${item.id}">
        <div class="prime-item__header">
          <div class="prime-item__header-content">
            <h3 class="prime-item__title">${this.escapeHtml(item.prompt)}</h3>
            ${
              item.category
                ? `<span class="prime-item__category">${this.escapeHtml(
                    this.capitalize(item.category),
                  )}</span>`
                : ""
            }
            ${
              item.notes
                ? `<p class="prime-item__description">${this.escapeHtml(
                    item.notes,
                  )}</p>`
                : ""
            }
          </div>
          <button
            id="menu-prime-${item.id}"
            class="icon-btn"
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
          <div class="prime-item__image-row">
            <img class="prime-item__image" src="${item.imageUrl}" alt="" />
          </div>
        `
            : ""
        }
        
        <div class="prime-item__footer">
        
          <div class="prime-item__stats">
            <div class="prime-stat"><span>Total</span><span>${totalCount}</span></div>
            <div class="prime-stat"><span>Today</span><span>${todayCount}</span></div>
            <div class="prime-stat"><span>This Week</span><span>${weekCount}</span></div>
            <div class="prime-stat"><span>This Month</span><span>${monthCount}</span></div>
            <div class="prime-stat"><span>First</span><span>${firstPrimeText}</span></div>
            <div class="prime-stat"><span>Last</span><span>${lastPrimeText}</span></div>
          </div>

          ${
            !showArchived
              ? `<button 
                  id="log-prime-${item.id}"
                  class="btn btn--primary prime-item__log-btn"
                  type="button">
                  Log Prime
                </button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  static attachItemListeners(
    item,
    {
      onLogPrime,
      onEdit,
      onDelete,
      onArchive,
      onConvertToReview,
      onConvertToStudy,
    },
    showArchived,
  ) {
    const logBtn = byId(`log-prime-${item.id}`);
    const menuBtn = byId(`menu-prime-${item.id}`);

    if (logBtn) {
      logBtn.addEventListener("click", () => onLogPrime(item));
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
  }

  static openForEdit(item) {
    const modal = byId(primeIds.primeModal);
    const modalTitle = byId(primeIds.primeModalTitle);
    const titleInput = byId(primeIds.primeTitle);
    const categoryInput = byId(primeIds.primeCategory);
    const notesInput = byId(primeIds.primeNotes);

    modalTitle.textContent = "Edit Prime Item";
    titleInput.value = item.prompt ?? "";
    categoryInput.value = item.category ?? "";
    if (notesInput) notesInput.value = item.notes ?? "";

    PrimeView._setupModalImages(item.imageUrl ?? null, item.noteImageUrl ?? null);

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  static openForCreate() {
    const modal = byId(primeIds.primeModal);
    const modalTitle = byId(primeIds.primeModalTitle);
    const titleInput = byId(primeIds.primeTitle);
    const categoryInput = byId(primeIds.primeCategory);
    const notesInput = byId(primeIds.primeNotes);

    modalTitle.textContent = "Add Prime Item";
    titleInput.value = "";
    categoryInput.value = "";
    if (notesInput) notesInput.value = "";

    PrimeView._setupModalImages(null, null);

    modal.classList.remove("hidden");
    titleInput.focus();
  }

  static close() {
    const modal = byId(primeIds.primeModal);
    modal.classList.add("hidden");
  }

  static readFormData() {
    return {
      prompt: byId(primeIds.primeTitle)?.value.trim() ?? "",
      category: byId(primeIds.primeCategory)?.value.trim() ?? "",
      notes: byId(primeIds.primeNotes)?.value.trim() ?? "",
    };
  }

  static readModalImageState() {
    const promptInput = byId(primeIds.modalPromptImageInput);
    const promptPreview = byId(primeIds.modalPromptImagePreview);
    const noteInput = byId(primeIds.modalNoteImageInput);
    const notePreview = byId(primeIds.modalNoteImagePreview);
    return {
      newPromptFile: promptInput?.files?.[0] ?? null,
      removePromptImage: promptPreview?.dataset.pendingRemove === "true",
      newNoteFile: noteInput?.files?.[0] ?? null,
      removeNoteImage: notePreview?.dataset.pendingRemove === "true",
    };
  }

  /** Wire up image preview/remove/upload for modal. Called on every open. */
  static _setupModalImages(currentPromptUrl, currentNoteUrl) {
    PrimeView._setupModalImageSlot(
      primeIds.modalPromptImagePreview,
      primeIds.modalPromptImagePreviewImg,
      primeIds.modalPromptImageRemoveBtn,
      primeIds.modalPromptImageInput,
      currentPromptUrl,
      primeIds.primeTitle,
    );
    PrimeView._setupModalImageSlot(
      primeIds.modalNoteImagePreview,
      primeIds.modalNoteImagePreviewImg,
      primeIds.modalNoteImageRemoveBtn,
      primeIds.modalNoteImageInput,
      currentNoteUrl,
      primeIds.primeNotes,
    );
  }

  static _setupModalImageSlot(previewId, previewImgId, removeBtnId, inputId, currentUrl, linkedFieldId = null) {
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

    // The linked text field's form-group to hide when an image is active
    const linkedGroup = linkedFieldId
      ? byId(linkedFieldId)?.closest(".form-group")
      : null;
    const linkedField = linkedFieldId ? byId(linkedFieldId) : null;
    const setLinkedFieldVisible = (visible) => {
      if (!linkedGroup) return;
      linkedGroup.style.display = visible ? "" : "none";
      if (linkedField && linkedField.required !== undefined) {
        linkedField.required = visible;
      }
    };

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
      setLinkedFieldVisible(false);
    } else {
      if (previewImg) previewImg.src = "";
      preview.classList.add("hidden");
      setLabelText(false);
      setLinkedFieldVisible(true);
    }

    removeBtn?.addEventListener("click", () => {
      preview.dataset.pendingRemove = "true";
      preview.classList.add("hidden");
      if (previewImg) previewImg.src = "";
      setLabelText(false);
      setLinkedFieldVisible(true);
    });

    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        delete preview.dataset.pendingRemove;
        if (previewImg) previewImg.src = URL.createObjectURL(file);
        preview.classList.remove("hidden");
        setLabelText(true);
        setLinkedFieldVisible(false);
      }
    });
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
