// controllers/study-controller.js
import { StudyItem } from "../domain/study-item.js";
import { StudyView } from "../views/study-view.js";
import { byId } from "../ui/ui-core.js";
import { studyIds } from "../ui/study-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import { bindAutoGrow } from "../utils/textarea.js";
import {
  createStudyItem,
  loadStudyItems,
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

let studyItems = [];

export function createStudyController() {
  studyItems = [];
  let editingItemId = null;
  let showArchived = false;

  const quickAddInput = byId(studyIds.quickAddStudyInput);
  const quickAddNotesWrap = byId(studyIds.quickAddNotesWrap);
  const quickAddNotesInput = byId(studyIds.quickAddNotesInput);
  const quickAddNotesToggleBtn = byId(studyIds.quickAddNotesToggleBtn);
  const quickAddCategoryInput = byId(studyIds.quickAddCategoryInput);
  const quickAddCategoryDropdown = byId(studyIds.quickAddCategoryDropdown);
  const addStudyBtn = byId(studyIds.addStudyBtn);

  const modalCategoryInput = byId(studyIds.studyCategory);
  const modalCategoryDropdown = byId(studyIds.modalCategoryDropdown);
  const headerMenuBtn = byId(studyIds.headerMenuBtn);

  let quickAddNotesVisible = true;

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

  bindAutoGrow(quickAddInput);
  bindAutoGrow(quickAddNotesInput);
  applyQuickAddNotesVisibility(true);

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
    if (quickAddImageBtn) {
      quickAddImageBtn.textContent = quickAddImageFile
        ? "Change Prompt Image"
        : "Prompt Image";
    }
    if (quickAddNoteImageBtn) {
      quickAddNoteImageBtn.textContent = quickAddNoteImageFile
        ? "Change Note Image"
        : "Note Image";
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

  async function refreshStudyItems({
    refreshCategories: shouldRefresh = true,
  } = {}) {
    try {
      const data = await loadStudyItems({ mode: "studying" });
      studyItems = data.map((item) => StudyItem.fromJSON(item));
    } catch (error) {
      console.error("Failed to load study items:", error);
      studyItems = [];
    }

    if (shouldRefresh) {
      await refreshCategories();
    }

    renderList();
  }

  // Initial load
  void refreshStudyItems();

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
    if (quickAddCategoryInput) quickAddCategoryInput.value = "";
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
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to create study item:", error);
      alert("Failed to create study item.");
    }
  }

  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList();
    updateHeaderMenu();
  };

  const handleCreateNew = () => {
    editingItemId = null;
    StudyView.openForCreate();
  };

  const getArchivedLabel = () =>
    showArchived ? "Hide Archived" : "Show Archived";

  const updateHeaderMenu = () => {
    if (headerMenu) headerMenu.dispose();

    const menuItems = [
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

    if (!data.prompt) {
      alert("Please enter a title for this study item");
      return;
    }

    const combinedNotes = [data.description, data.notes]
      .filter(Boolean)
      .join("\n\n");

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

      queueMicrotask(() => renderList());
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
    if (!confirm(`Delete "${item.prompt}"?`)) return;
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

  function renderList() {
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
    );
  }

  return {
    getStudyItems: () => [...studyItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      headerMenu?.dispose();
      modalCategoryManager?.dispose();
    },
  };
}
