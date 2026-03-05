import { StudyItem } from "../domain/study-item.js";
import { PrimeView } from "../views/prime-view.js";
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createCategoryFilterModal } from "../views/components/category-filter-modal.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import { isMobile } from "../utils/viewport.js";
import { bindAutoGrow } from "../utils/textarea.js";

import {
  loadStudyItems,
  loadStudyItemsPage,
  createStudyItem,
  updateStudyItem,
  deleteStudyItem,
  logInteraction,
  transitionToStudying,
  transitionToReviewing,
  loadCategories,
  uploadPromptImage,
  removePromptImage,
  uploadNoteImage,
  removeNoteImage,
} from "../api/studyItemApi.js";

let studyItems = [];

export function createPrimeController() {
  studyItems = [];

  const CATEGORY_FILTER_KEY = "primeCategoryFilter";

  let editingItemId = null;
  let showArchived = false;
  let currentCategoryFilter = localStorage.getItem(CATEGORY_FILTER_KEY) || "";
  let currentSearchQuery = "";
  let currentPage = 1;
  let hasNextPage = true;
  let isLoadingPage = false;
  let observer = null;
  let observedSentinel = null;

  function getActiveQuery() {
    return {
      mode: "priming",
      category: currentCategoryFilter || undefined,
      search: currentSearchQuery || undefined,
    };
  }

  function resetAndLoad() {
    currentPage = 1;
    hasNextPage = true;
    studyItems = [];
    PrimeView.resetRenderState();
    observer?.disconnect();
    observedSentinel = null;
    void loadPrimePage(1);
  }
  const QUICK_ADD_NOTES_DEFAULT_KEY = "primeQuickAddNotesDefault";

  const addBtn = byId(primeIds.addPrimeBtn);
  const quickAddInput = byId(primeIds.quickAddPrimeInput);
  const quickAddCategoryInput = byId(primeIds.quickAddCategoryInput);
  const headerMenuBtn = byId(primeIds.headerMenuBtn);
  const quickAddImageBtn = byId(primeIds.quickAddImageBtn);
  const quickAddImageInput = byId(primeIds.quickAddImageInput);
  const quickAddImagePreview = byId(primeIds.quickAddImagePreview);
  const quickAddImagePreviewImg = byId(primeIds.quickAddImagePreviewImg);
  const quickAddNoteImageBtn = byId(primeIds.quickAddNoteImageBtn);
  const quickAddNoteImageInput = byId(primeIds.quickAddNoteImageInput);
  const quickAddNoteImagePreview = byId(primeIds.quickAddNoteImagePreview);
  const quickAddNoteImagePreviewImg = byId(primeIds.quickAddNoteImagePreviewImg);
  const quickAddCategoryDropdown = byId(primeIds.categoryDropdown);
  const modalCategoryInput = byId(primeIds.primeCategory);
  const modalCategoryDropdown = byId(primeIds.modalCategoryDropdown);
  const quickAddNotesToggleBtn = byId(primeIds.quickAddNotesToggleBtn);
  const quickAddNotesWrap = byId(primeIds.quickAddNotesWrap);
  const quickAddNotesInput = byId(primeIds.quickAddNotesInput);

  let quickAddNotesVisible = false;

  function getQuickAddNotesDefault() {
    return localStorage.getItem(QUICK_ADD_NOTES_DEFAULT_KEY) === "on";
  }

  function setQuickAddNotesDefault(value) {
    localStorage.setItem(QUICK_ADD_NOTES_DEFAULT_KEY, value ? "on" : "off");
  }

  function applyQuickAddNotesVisibility(isVisible) {
    quickAddNotesVisible = isVisible;
    if (quickAddNotesWrap) {
      quickAddNotesWrap.classList.toggle("hidden", !isVisible);
    }
    if (quickAddNotesToggleBtn) {
      quickAddNotesToggleBtn.textContent = isVisible
        ? "Hide Notes"
        : "Add Notes";
    }
    if (!isVisible && quickAddNotesInput) {
      quickAddNotesInput.value = "";
    }
  }

  const quickAddCategoryManager = new CategoryManager(
    quickAddCategoryInput,
    quickAddCategoryDropdown,
    null,
  );

  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null,
  );

  let quickAddImageFile = null;
  let quickAddNoteImageFile = null;

  bindAutoGrow(quickAddInput);
  bindAutoGrow(quickAddNotesInput);
  applyQuickAddNotesVisibility(getQuickAddNotesDefault());
  updateButtonText();

  quickAddNotesToggleBtn?.addEventListener("click", () => {
    applyQuickAddNotesVisibility(!quickAddNotesVisible);
  });

  quickAddImageBtn.addEventListener("click", () => {
    quickAddImageInput.click();
  });

  quickAddImageInput.addEventListener("change", () => {
    quickAddImageFile = quickAddImageInput.files?.[0] ?? null;

    if (quickAddImageFile) {
      quickAddImagePreviewImg.src = URL.createObjectURL(quickAddImageFile);
      quickAddImagePreview.classList.remove("hidden");
    } else {
      quickAddImagePreviewImg.src = "";
      quickAddImagePreview.classList.add("hidden");
    }

    updateButtonText();
    syncInputVisibility();
  });

  quickAddNoteImageBtn.addEventListener("click", () => {
    quickAddNoteImageInput.click();
  });

  quickAddNoteImageInput.addEventListener("change", () => {
    quickAddNoteImageFile = quickAddNoteImageInput.files?.[0] ?? null;

    if (quickAddNoteImageFile) {
      quickAddNoteImagePreviewImg.src = URL.createObjectURL(quickAddNoteImageFile);
      quickAddNoteImagePreview.classList.remove("hidden");
    } else {
      quickAddNoteImagePreviewImg.src = "";
      quickAddNoteImagePreview.classList.add("hidden");
    }

    updateButtonText();
    syncInputVisibility();
  });

  addBtn.addEventListener("click", async () => {
    const prompt = quickAddInput.value.trim();

    if (!prompt && !quickAddImageFile) {
      return;
    }

    await handleCreateNew({
      prompt: prompt || "",
      category: quickAddCategoryInput.value.trim(),
      notes: quickAddNotesInput?.value.trim() || "",
      imageFile: quickAddImageFile,
      noteImageFile: quickAddNoteImageFile,
    });

    quickAddInput.value = "";
    quickAddCategoryInput.value = "";
    quickAddImageInput.value = "";
    quickAddImageFile = null;
    quickAddImagePreviewImg.src = "";
    quickAddImagePreview.classList.add("hidden");
    quickAddNoteImageInput.value = "";
    quickAddNoteImageFile = null;
    quickAddNoteImagePreviewImg.src = "";
    quickAddNoteImagePreview.classList.add("hidden");
    quickAddNotesInput.value = "";
    applyQuickAddNotesVisibility(getQuickAddNotesDefault());
    updateButtonText();
    syncInputVisibility();
  });

  function syncInputVisibility() {
    quickAddInput.classList.toggle("hidden", !!quickAddImageFile);
    quickAddNotesWrap.classList.toggle("hidden", !!quickAddNoteImageFile);
    if (quickAddNoteImageFile) {
      quickAddNotesToggleBtn.textContent = "Hide Notes";
    }
  }

  function updateButtonText() {
    if (quickAddImageFile) {
      quickAddImageBtn.textContent = isMobile(480) ? "📷 ✓" : "Change Prompt Image";
    } else {
      quickAddImageBtn.textContent = isMobile(480) ? "📷" : "Prompt Image";
    }
    if (quickAddNoteImageFile) {
      quickAddNoteImageBtn.textContent = isMobile(480) ? "🗒️ ✓" : "Change Note Image";
    } else {
      quickAddNoteImageBtn.textContent = isMobile(480) ? "🗒️" : "Note Image";
    }
  }

  window.addEventListener("resize", updateButtonText);

  // ---------- LOAD ----------

  async function loadPrimePage(
    page,
    { refreshCategories: shouldRefresh = true } = {},
  ) {
    if (isLoadingPage) return;
    isLoadingPage = true;

    try {
      const { items, next } = await loadStudyItemsPage({
        ...getActiveQuery(),
        page,
      });

      const mapped = items.map((item) => StudyItem.fromJSON(item));

      if (page === 1) {
        studyItems = mapped;
        PrimeView.resetRenderState();
      } else {
        studyItems = [...studyItems, ...mapped];
      }

      hasNextPage = Boolean(next);
      currentPage = page;

      if (shouldRefresh && page === 1) {
        await refreshCategories();
      }

      renderList({ showSentinel: hasNextPage });
      attachSentinelObserver();
    } finally {
      isLoadingPage = false;
    }
  }

  function attachSentinelObserver() {
    const sentinel = document.getElementById(primeIds.primeListSentinel);
    if (!sentinel || observedSentinel === sentinel) return;

    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage) {
          loadPrimePage(currentPage + 1, { refreshCategories: false });
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(sentinel);
    observedSentinel = sentinel;
  }

  async function refreshPrimeItems({
    refreshCategories: shouldRefresh = true,
  } = {}) {
    await loadPrimePage(1, { refreshCategories: shouldRefresh });
  }

  async function refreshCategories() {
    try {
      const categories = await loadCategories({ mode: "priming" });
      quickAddCategoryManager.setCategories(categories);
      modalCategoryManager.setCategories(categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }

  // Initial load
  void loadPrimePage(1);

  // ---------- CREATE ----------

  async function handleCreateNew(data) {
    try {
      await createStudyItem(
        {
          prompt: data.prompt,
          notes: data.notes || "",
          category: data.category || "",
          is_priming: true,
          is_studying: false,
          is_reviewing: false,
        },
        data.imageFile ?? null,
        data.noteImageFile ?? null,
      );

      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to create prime item:", error);
      alert("Failed to create prime item.");
    }
  }

  // ---------- LOG ----------

  async function handleLog(item) {
    try {
      await logInteraction(item.id);
      SoundManager.play("primeLogged");

      // remove it locally so it disappears immediately
      studyItems = studyItems.filter((i) => i.id !== item.id);
      renderList();
    } catch (error) {
      console.error("Failed to log prime:", error);
      alert("Failed to log prime.");
    }
  }

  // ---------- TRANSITIONS ----------

  async function handleConvertToStudy(item) {
    try {
      await transitionToStudying(item.id);

      studyItems = studyItems.filter((i) => i.id !== item.id);
      renderList({ showSentinel: hasNextPage });
    } catch (error) {
      console.error("Failed to transition to study:", error);
      alert("Failed to convert to study.");
    }
  }

  async function handleConvertToReview(item) {
    try {
      await transitionToReviewing(item.id);
      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to transition to review:", error);
      alert("Failed to convert to review.");
    }
  }

  // ---------- ARCHIVE ----------

  async function handleArchive(item) {
    try {
      await updateStudyItem(item.id, { is_archived: true });
      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to archive item:", error);
    }
  }

  async function handleRestore(item) {
    try {
      await updateStudyItem(item.id, { is_archived: false });
      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to restore item:", error);
    }
  }

  // ---------- DELETE ----------

  async function handleDelete(item) {
    try {
      await deleteStudyItem(item.id);
      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  }

  // ---------- RENDER ----------

  function renderList({ showSentinel = false } = {}) {
    const visibleItems = showArchived
      ? studyItems.filter((i) => i.isArchived)
      : studyItems.filter((i) => !i.isArchived);

    PrimeView.renderList(
      visibleItems,
      {
        onLogPrime: handleLog,
        onEdit: (item) => {
          editingItemId = item.id;
          PrimeView.openForEdit(item);
        },
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToStudy: handleConvertToStudy,
        onConvertToReview: handleConvertToReview,
      },
      showArchived,
      { showSentinel },
    );
  }

  // ---------- HEADER MENU ----------

  const categoryFilterModal = createCategoryFilterModal({
    title: "Filter by Category",
    onFilter: (category) => {
      currentCategoryFilter = category;
      if (category) {
        localStorage.setItem(CATEGORY_FILTER_KEY, category);
      } else {
        localStorage.removeItem(CATEGORY_FILTER_KEY);
      }
      updateHeaderMenu();
      resetAndLoad();
    },
  });

  let headerMenu = null;

  function updateHeaderMenu() {
    if (headerMenu) headerMenu.dispose();

    const filterLabel = currentCategoryFilter
      ? `Category: ${currentCategoryFilter}`
      : "Filter by Category";

    headerMenu = createDropdownMenu({
      items: [
        {
          label: filterLabel,
          onSelect: async () => {
            const categories = await loadCategories({ mode: "priming" }).catch(() => []);
            categoryFilterModal.open(categories, currentCategoryFilter);
          },
        },
        ...(currentCategoryFilter
          ? [{ label: "Clear Filter", onSelect: () => { currentCategoryFilter = ""; localStorage.removeItem(CATEGORY_FILTER_KEY); updateHeaderMenu(); resetAndLoad(); } }]
          : []),
        {
          label: getQuickAddNotesDefault()
            ? "Disable Notes by Default"
            : "Enable Notes by Default",
          onSelect: () => {
            const next = !getQuickAddNotesDefault();
            setQuickAddNotesDefault(next);
            applyQuickAddNotesVisibility(next);
            updateHeaderMenu();
          },
        },
        {
          label: showArchived ? "Hide Archived" : "Show Archived",
          onSelect: () => {
            showArchived = !showArchived;
            renderList();
            updateHeaderMenu();
          },
        },
      ],
    });

    headerMenu.attachTo(headerMenuBtn);
  }

  updateHeaderMenu();

  // ---------- MODAL FORM (create / edit) ----------

  const primeForm = byId(primeIds.primeForm);
  const primeCancelBtn = byId(primeIds.primeCancelBtn);

  primeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = PrimeView.readFormData();
    const imageState = PrimeView.readModalImageState();

    const hasPromptImage = imageState.newPromptFile ||
      (!imageState.removePromptImage && studyItems.find(i => i.id === editingItemId)?.imageUrl);

    if (!data.prompt && !hasPromptImage) return;

    try {
      if (editingItemId) {
        await updateStudyItem(editingItemId, {
          prompt: data.prompt,
          category: data.category,
          notes: data.notes,
        });

        if (imageState.removePromptImage) {
          await removePromptImage(editingItemId).catch(() => {});
        } else if (imageState.newPromptFile) {
          await uploadPromptImage(editingItemId, imageState.newPromptFile);
        }

        if (imageState.removeNoteImage) {
          await removeNoteImage(editingItemId).catch(() => {});
        } else if (imageState.newNoteFile) {
          await uploadNoteImage(editingItemId, imageState.newNoteFile);
        }
      } else {
        await handleCreateNew(data);
      }
    } catch (err) {
      console.error("Failed to save prime item:", err);
      alert("Failed to save prime item.");
    } finally {
      editingItemId = null;
      PrimeView.close();
      await refreshPrimeItems();
    }
  });

  primeCancelBtn?.addEventListener("click", () => {
    editingItemId = null;
    PrimeView.close();
  });

  // ---------- PUBLIC API ----------

  return {
    refresh: refreshPrimeItems,
    dispose() {
      headerMenu?.dispose();
      categoryFilterModal.dispose();
      observer?.disconnect();
    },
  };
}
