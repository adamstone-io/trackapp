// controllers/study-controller.js
import { StudyItem } from "../domain/study-item.js";
import { StudyView } from "../views/study-view.js";
import { byId } from "../ui/ui-core.js";
import { studyIds } from "../ui/study-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createCategoryFilterModal } from "../views/components/category-filter-modal.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import { isMobile } from "../utils/viewport.js";
import { bindAutoGrow } from "../utils/textarea.js";
import {
  createStudyItem,
  loadStudyItemsPage,
  updateStudyItem,
  deleteStudyItem,
  logInteraction,
  transitionToPriming,
  transitionToReviewing,
  loadCategories,
  uploadPromptImage,
  removePromptImage,
  uploadNoteImage,
  removeNoteImage,
} from "../api/studyItemApi.js";

import { parseStudyItemMarkdown } from "../utils/study-item-markdown-import.js";

let studyItems = [];

export function createStudyController() {
  studyItems = [];
  const CATEGORY_FILTER_KEY = "studyCategoryFilter";

  let editingItemId = null;
  let showArchived = false;
  let currentCategoryFilter = localStorage.getItem(CATEGORY_FILTER_KEY) || "";
  let currentPage = 1;
  let hasNextPage = true;
  let isLoadingPage = false;
  let observer = null;
  let observedSentinel = null;

  const quickAddInput = byId(studyIds.quickAddStudyInput);
  const quickAddNotesWrap = byId(studyIds.quickAddNotesWrap);
  const quickAddNotesInput = byId(studyIds.quickAddNotesInput);
  const quickAddNotesToggleBtn = byId(studyIds.quickAddNotesToggleBtn);
  const quickAddCategoryInput = byId(studyIds.quickAddCategoryInput);
  const quickAddCategoryPinBtn = byId(studyIds.quickAddCategoryPinBtn);
  const quickAddCategoryDropdown = byId(studyIds.quickAddCategoryDropdown);
  const addStudyBtn = byId(studyIds.addStudyBtn);

  const modalCategoryInput = byId(studyIds.studyCategory);
  const modalCategoryDropdown = byId(studyIds.modalCategoryDropdown);
  const headerMenuBtn = byId(studyIds.headerMenuBtn);

  let quickAddNotesVisible = true;
  const QUICK_ADD_PINNED_CATEGORY_KEY = "studyQuickAddPinnedCategory";

  function getPinnedCategory() {
    return localStorage.getItem(QUICK_ADD_PINNED_CATEGORY_KEY) || "";
  }

  function setPinnedCategory(category) {
    const normalized = category.trim();
    if (normalized) {
      localStorage.setItem(QUICK_ADD_PINNED_CATEGORY_KEY, normalized);
    } else {
      localStorage.removeItem(QUICK_ADD_PINNED_CATEGORY_KEY);
    }
    syncPinnedCategoryUi();
  }

  function syncPinnedCategoryUi() {
    const pinnedCategory = getPinnedCategory();
    if (!quickAddCategoryPinBtn) return;

    const isPinned = Boolean(pinnedCategory);
    quickAddCategoryPinBtn.classList.toggle("category-pin-btn--active", isPinned);
    quickAddCategoryPinBtn.setAttribute("aria-pressed", String(isPinned));
    quickAddCategoryPinBtn.setAttribute(
      "aria-label",
      isPinned ? `Unpin category ${pinnedCategory}` : "Pin category",
    );
    quickAddCategoryPinBtn.title = isPinned
      ? `Pinned to ${pinnedCategory}. Click to unpin.`
      : "Pin current category";
  }

  function applyPinnedCategoryToInput() {
    const pinnedCategory = getPinnedCategory();
    if (pinnedCategory) {
      quickAddCategoryInput.value = pinnedCategory;
    }
    syncPinnedCategoryUi();
  }

  function togglePinnedCategory() {
    const currentPinnedCategory = getPinnedCategory();
    if (currentPinnedCategory) {
      setPinnedCategory("");
      quickAddCategoryInput.value = "";
      return;
    }

    const category = quickAddCategoryInput.value.trim();
    if (!category) return;
    setPinnedCategory(category);
  }

  function applyQuickAddNotesVisibility(isVisible) {
    quickAddNotesVisible = isVisible;
    if (quickAddNotesWrap) {
      quickAddNotesWrap.classList.toggle("hidden", !isVisible);
    }
    if (!isVisible && quickAddNotesInput) {
      quickAddNotesInput.value = "";
    }
    updateImageButtonText();
  }

  quickAddCategoryPinBtn?.addEventListener("click", () => {
    togglePinnedCategory();
  });

  quickAddCategoryInput?.addEventListener("input", () => {
    if (getPinnedCategory()) {
      setPinnedCategory(quickAddCategoryInput.value);
    }
  });

  quickAddNotesToggleBtn?.addEventListener("click", () => {
    applyQuickAddNotesVisibility(!quickAddNotesVisible);
  });

  const quickAddImageBtn = byId(studyIds.quickAddImageBtn);
  const quickAddImageInput = byId(studyIds.quickAddImageInput);
  const quickAddImagePreview = byId(studyIds.quickAddImagePreview);
  const quickAddImagePreviewImg = byId(studyIds.quickAddImagePreviewImg);
  const quickAddNoteImageBtn = byId(studyIds.quickAddNoteImageBtn);
  const quickAddNoteImageInput = byId(studyIds.quickAddNoteImageInput);
  const quickAddNoteImagePreview = byId(studyIds.quickAddNoteImagePreview);
  const quickAddNoteImagePreviewImg = byId(studyIds.quickAddNoteImagePreviewImg);

  let quickAddImageFile = null;
  let quickAddNoteImageFile = null;

  function updateImageButtonText() {
    const mobile = isMobile(768);

    if (quickAddNotesToggleBtn) {
      if (mobile) {
        quickAddNotesToggleBtn.textContent = quickAddNotesVisible ? "📝 ✓" : "📝";
      } else {
        quickAddNotesToggleBtn.textContent = quickAddNotesVisible ? "Hide Notes" : "Add Notes";
      }
    }

    if (quickAddImageBtn) {
      if (mobile) {
        quickAddImageBtn.textContent = quickAddImageFile ? "📷 ✓" : "📷";
      } else {
        quickAddImageBtn.textContent = quickAddImageFile ? "Change Prompt Image" : "Prompt Image";
      }
    }

    if (quickAddNoteImageBtn) {
      if (mobile) {
        quickAddNoteImageBtn.textContent = quickAddNoteImageFile ? "🗒️ ✓" : "🗒️";
      } else {
        quickAddNoteImageBtn.textContent = quickAddNoteImageFile ? "Change Note Image" : "Note Image";
      }
    }
  }

  quickAddImageBtn?.addEventListener("click", () => quickAddImageInput?.click());
  quickAddImageInput?.addEventListener("change", () => {
    quickAddImageFile = quickAddImageInput.files?.[0] ?? null;
    if (quickAddImageFile) {
      quickAddImagePreviewImg.src = URL.createObjectURL(quickAddImageFile);
      quickAddImagePreview.classList.remove("hidden");
    } else {
      quickAddImagePreviewImg.src = "";
      quickAddImagePreview.classList.add("hidden");
    }
    updateImageButtonText();
    syncInputVisibility();
  });

  quickAddNoteImageBtn?.addEventListener("click", () => quickAddNoteImageInput?.click());
  quickAddNoteImageInput?.addEventListener("change", () => {
    quickAddNoteImageFile = quickAddNoteImageInput.files?.[0] ?? null;
    if (quickAddNoteImageFile) {
      quickAddNoteImagePreviewImg.src = URL.createObjectURL(quickAddNoteImageFile);
      quickAddNoteImagePreview.classList.remove("hidden");
    } else {
      quickAddNoteImagePreviewImg.src = "";
      quickAddNoteImagePreview.classList.add("hidden");
    }
    updateImageButtonText();
    syncInputVisibility();
  });

  function syncInputVisibility() {
    if (quickAddInput) quickAddInput.classList.toggle("hidden", !!quickAddImageFile);
    if (quickAddNotesWrap) quickAddNotesWrap.classList.toggle("hidden", !!quickAddNoteImageFile);
  }

  bindAutoGrow(quickAddInput);
  bindAutoGrow(quickAddNotesInput);
  applyQuickAddNotesVisibility(true);
  applyPinnedCategoryToInput();
  updateImageButtonText();
  window.addEventListener("resize", updateImageButtonText);

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

  async function refreshCategories() {
    try {
      const categories = await loadCategories({ mode: "studying" });
      quickAddCategoryManager.setCategories(categories);
      modalCategoryManager.setCategories(categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }

  async function loadStudyPage(
    page,
    { refreshCategories: shouldRefresh = true } = {},
  ) {
    if (isLoadingPage) return;
    isLoadingPage = true;

    try {
      const { items, next } = await loadStudyItemsPage({
        mode: "studying",
        category: currentCategoryFilter || undefined,
        page,
      });

      const mapped = items.map((item) => StudyItem.fromJSON(item));

      if (page === 1) {
        studyItems = mapped;
        StudyView.resetRenderState();
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
    } catch (error) {
      console.error("Failed to load study items:", error);
    } finally {
      isLoadingPage = false;
    }
  }

  function attachSentinelObserver() {
    const sentinel = document.getElementById(studyIds.studyListSentinel);
    if (!sentinel || observedSentinel === sentinel) return;

    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage) {
          loadStudyPage(currentPage + 1, { refreshCategories: false });
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(sentinel);
    observedSentinel = sentinel;
  }

  async function refreshStudyItems({
    refreshCategories: shouldRefresh = true,
  } = {}) {
    await loadStudyPage(1, { refreshCategories: shouldRefresh });
  }

  function resetAndLoad() {
    currentPage = 1;
    hasNextPage = true;
    studyItems = [];
    StudyView.resetRenderState();
    observer?.disconnect();
    observedSentinel = null;
    void loadStudyPage(1, { refreshCategories: false });
  }

  // Initial load
  void loadStudyPage(1);

  addStudyBtn?.addEventListener("click", async () => {
    const prompt = quickAddInput.value.trim();
    const notes = quickAddNotesInput.value.trim();
    const category = quickAddCategoryInput.value.trim();

    if (!prompt && !quickAddImageFile) {
      quickAddInput?.focus();
      return;
    }

    await handleCreateQuickAdd({
      prompt,
      notes,
      category,
      imageFile: quickAddImageFile,
      noteImageFile: quickAddNoteImageFile,
    });

    if (quickAddInput) quickAddInput.value = "";
    if (quickAddNotesInput) quickAddNotesInput.value = "";
    applyPinnedCategoryToInput();
    if (quickAddImageInput) quickAddImageInput.value = "";
    quickAddImageFile = null;
    quickAddImagePreviewImg.src = "";
    quickAddImagePreview.classList.add("hidden");
    if (quickAddNoteImageInput) quickAddNoteImageInput.value = "";
    quickAddNoteImageFile = null;
    quickAddNoteImagePreviewImg.src = "";
    quickAddNoteImagePreview.classList.add("hidden");
    updateImageButtonText();
    syncInputVisibility();
    applyQuickAddNotesVisibility(true);
  });

  async function handleCreateQuickAdd({ prompt, notes, category, imageFile = null, noteImageFile = null }) {
    try {
      await createStudyItem(
        {
          prompt: prompt || "",
          notes: notes || "",
          category: category || "",
          is_priming: false,
          is_studying: true,
          is_reviewing: false,
        },
        imageFile,
        noteImageFile,
      );

      if (category?.trim()) {
        quickAddCategoryManager.incrementCategory(category);
        if (getPinnedCategory()) {
          setPinnedCategory(category);
        }
      }

      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to create study item:", error);
      alert("Failed to create study item.");
    }
  }

  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList({ showSentinel: hasNextPage });
    updateHeaderMenu();
  };

  const handleCreateNew = () => {
    editingItemId = null;
    StudyView.openForCreate();
  };

  const getArchivedLabel = () =>
    showArchived ? "Hide Archived" : "Show Archived";

  let importMarkdownFileInput = null;

  async function importStudyItemsFromMarkdownFile(file) {
    const text = await file.text();
    const { category, items } = parseStudyItemMarkdown(text);

    if (!items.length) {
      alert("No study items found in that file.");
      return;
    }

    const preview = items.slice(0, 3).map((x) => `- ${x.prompt}`).join("\n");
    const ok = confirm(
      `Import ${items.length} study items?\n\nCategory: ${category || "(none)"}\n\nFirst items:\n${preview}`,
    );
    if (!ok) return;

    let created = 0;
    for (const item of items) {
      await createStudyItem({
        prompt: item.prompt,
        notes: item.notes,
        category: item.category,
        is_priming: false,
        is_studying: true,
        is_reviewing: false,
      });
      created += 1;
    }

    await refreshStudyItems({ refreshCategories: true });
    alert(`Imported ${created} study items.`);
  }

  function ensureImportMarkdownFileInput() {
    if (importMarkdownFileInput) return;

    importMarkdownFileInput = document.createElement("input");
    importMarkdownFileInput.type = "file";
    importMarkdownFileInput.accept = ".md,.markdown,text/markdown";
    importMarkdownFileInput.style.display = "none";
    document.body.appendChild(importMarkdownFileInput);

    importMarkdownFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await importStudyItemsFromMarkdownFile(file);
      } catch (err) {
        console.error("Import failed:", err);
        alert("Import failed. Check the console for details.");
      } finally {
        e.target.value = "";
      }
    });
  }

  function handleImportMarkdown() {
    ensureImportMarkdownFileInput();
    importMarkdownFileInput.click();
  }

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

  const updateHeaderMenu = () => {
    if (headerMenu) headerMenu.dispose();

    ensureImportMarkdownFileInput();

    const filterLabel = currentCategoryFilter
      ? `Category: ${currentCategoryFilter}`
      : "Filter by Category";

    const menuItems = [
      {
        label: filterLabel,
        onSelect: async () => {
          const categories = await loadCategories({ mode: "studying" }).catch(() => []);
          categoryFilterModal.open(categories, currentCategoryFilter);
        },
      },
      ...(currentCategoryFilter
        ? [{
            label: "Clear Filter",
            onSelect: () => {
              currentCategoryFilter = "";
              localStorage.removeItem(CATEGORY_FILTER_KEY);
              updateHeaderMenu();
              resetAndLoad();
            },
          }]
        : []),
      {
        label: "Import Markdown…",
        onSelect: () => handleImportMarkdown(),
      },
      { label: "New Study Item", onSelect: handleCreateNew },
      { label: getArchivedLabel(), onSelect: handleToggleArchived },
    ];

    headerMenu = createDropdownMenu({ items: menuItems });
    headerMenu.attachTo(headerMenuBtn);
  };

  let headerMenu = null;
  updateHeaderMenu();

  // Bind modal form
  const unbindModal = StudyView.bind({
    onSave: handleSave,
    onCancel: handleCancel,
  });

  async function handleSave() {
    const data = StudyView.readFormData();

    if (editingItemId) {
      const imageState = StudyView.readModalImageState();
      const hasPromptImage = imageState.newPromptFile ||
        (!imageState.removePromptImage && studyItems.find(i => i.id === editingItemId)?.imageUrl);

      if (!data.prompt && !hasPromptImage) {
        alert("Please enter a prompt or upload a prompt image.");
        return;
      }
    } else if (!data.prompt) {
      alert("Please enter a title for this study item");
      return;
    }

    const combinedNotes = data.notes || "";

    if (editingItemId) {
      const imageState = StudyView.readModalImageState();
      try {
        await updateStudyItem(editingItemId, {
          prompt: data.prompt,
          category: data.category,
          notes: combinedNotes,
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

        editingItemId = null;
        await refreshStudyItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to update study item:", error);
        alert("Failed to update study item. Please try again.");
        return;
      }
    } else {
      try {
        await createStudyItem({
          prompt: data.prompt,
          category: data.category,
          notes: combinedNotes,
          is_priming: false,
          is_studying: true,
          is_reviewing: false,
        });
        await refreshStudyItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to create study item:", error);
        alert("Failed to create study item. Please try again.");
        return;
      }
    }

    StudyView.close();
  }

  function handleCancel() {
    editingItemId = null;
    StudyView.close();
  }

  async function handleLogStudy(item) {
    try {
      const updated = await logInteraction(item.id);
      SoundManager.play("studyLogged");

      const index = studyItems.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        studyItems[index] = StudyItem.fromJSON(updated);
      }

      queueMicrotask(() => renderList({ showSentinel: hasNextPage }));
    } catch (error) {
      console.error("Failed to log study:", error);
      alert("Failed to log study. Please try again.");
    }
  }

  function handleEdit(item) {
    editingItemId = item.id;
    StudyView.openForEdit(item);
  }

  async function handleDelete(item) {
    try {
      await deleteStudyItem(item.id);
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to delete study item:", error);
      alert("Failed to delete study item. Please try again.");
    }
  }

  async function handleArchive(item) {
    if (
      !confirm(
        `Archive "${item.prompt}"? You can restore it later from archived items.`,
      )
    )
      return;

    try {
      await updateStudyItem(item.id, { is_archived: true });
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to archive study item:", error);
      alert("Failed to archive study item. Please try again.");
    }
  }

  async function handleRestore(item) {
    try {
      await updateStudyItem(item.id, { is_archived: false });
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to restore study item:", error);
      alert("Failed to restore study item. Please try again.");
    }
  }

  async function handleConvertToReview(item) {
    try {
      await transitionToReviewing(item.id);
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to convert study item:", error);
      alert("Failed to convert study item. Please try again.");
    }
  }

  async function handleConvertToPriming(item) {
    try {
      await transitionToPriming(item.id);
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to convert study item:", error);
      alert("Failed to convert study item. Please try again.");
    }
  }

  async function handleNotesUpdate(item, newNotes) {
    if (item.notes === newNotes) return;

    try {
      await updateStudyItem(item.id, { notes: newNotes });
      const itemIndex = studyItems.findIndex((s) => s.id === item.id);
      if (itemIndex !== -1) {
        studyItems[itemIndex].notes = newNotes;
      }
    } catch (error) {
      console.error("Failed to update notes:", error);
    }
  }

  function renderList({ showSentinel = false } = {}) {
    const itemsToShow = showArchived
      ? studyItems.filter((item) => item.isArchived)
      : studyItems.filter((item) => !item.isArchived);

    StudyView.renderList(
      itemsToShow,
      {
        onLogStudy: handleLogStudy,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToReview: handleConvertToReview,
        onConvertToPriming: handleConvertToPriming,
        onNotesUpdate: handleNotesUpdate,

      },
      showArchived,
      { showSentinel },
    );

    if (showSentinel) {
      attachSentinelObserver();
    } else {
      observer?.disconnect();
      observedSentinel = null;
    }
  }

  return {
    getStudyItems: () => [...studyItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      headerMenu?.dispose();
      modalCategoryManager?.dispose();
      categoryFilterModal.dispose();
      observer?.disconnect();
    },
  };
}
