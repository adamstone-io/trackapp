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
  createStudyItem,
  updateStudyItem,
  deleteStudyItem,
  logInteraction,
  transitionToStudying,
  transitionToReviewing,
  loadCategories,
} from "../api/studyItemApi.js";

let studyItems = [];

export function createPrimeController() {
  studyItems = [];

  let editingItemId = null;
  let showArchived = false;
  let currentCategoryFilter = "";
  let currentSearchQuery = "";

  const addBtn = byId(primeIds.addPrimeBtn);
  const quickAddInput = byId(primeIds.quickAddPrimeInput);
  const quickAddCategoryInput = byId(primeIds.quickAddCategoryInput);
  const headerMenuBtn = byId(primeIds.headerMenuBtn);
  const quickAddImageBtn = byId(primeIds.quickAddImageBtn);
  const quickAddImageInput = byId(primeIds.quickAddImageInput);
  const quickAddImagePreview = byId(primeIds.quickAddImagePreview);
  const quickAddImagePreviewImg = byId(primeIds.quickAddImagePreviewImg);
  const quickAddCategoryDropdown = byId(primeIds.categoryDropdown);
  const modalCategoryInput = byId(primeIds.primeCategory);
  const modalCategoryDropdown = byId(primeIds.modalCategoryDropdown);

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

  bindAutoGrow(quickAddInput);
  updateButtonText();

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
  });

  addBtn.addEventListener("click", async () => {
    const prompt = quickAddInput.value.trim();

    if (!prompt && !quickAddImageFile) {
      return;
    }

    await handleCreateNew({
      prompt: prompt || "",
      category: quickAddCategoryInput.value.trim(),
      notes: "",
      imageFile: quickAddImageFile,
    });

    quickAddInput.value = "";
    quickAddCategoryInput.value = "";
    quickAddImageInput.value = "";
    quickAddImageFile = null;
    quickAddImagePreviewImg.src = "";
    quickAddImagePreview.classList.add("hidden");
    quickAddImageBtn.textContent = "Add Image";
  });

  function updateButtonText() {
    if (quickAddImageFile) {
      quickAddImageBtn.textContent = isMobile(480) ? "📷 ✓" : "Change Image";
    } else {
      quickAddImageBtn.textContent = isMobile(480) ? "📷" : "Add Image";
    }
  }

  window.addEventListener("resize", updateButtonText);

  // ---------- LOAD ----------

  async function refreshPrimeItems({
    refreshCategories: shouldRefresh = true,
  } = {}) {
    try {
      const data = await loadStudyItems({
        mode: "priming",
        category: currentCategoryFilter || undefined,
        search: currentSearchQuery || undefined,
      });

      studyItems = data.map((item) => StudyItem.fromJSON(item));
    } catch (error) {
      console.error("Failed to load prime items:", error);
      studyItems = [];
    }

    if (shouldRefresh) {
      await refreshCategories();
    }

    renderList();
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
  void refreshPrimeItems();

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
      const updated = await logInteraction(item.id);
      SoundManager.play("primeLogged");

      const index = studyItems.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        studyItems[index] = StudyItem.fromJSON(updated);
        console.log("test");
      }

      queueMicrotask(() => renderList());
    } catch (error) {
      console.error("Failed to log prime:", error);
      alert("Failed to log prime.");
    }
  }

  // ---------- TRANSITIONS ----------

  async function handleConvertToStudy(item) {
    try {
      await transitionToStudying(item.id);
      await refreshPrimeItems();
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
    if (!confirm(`Delete "${item.prompt}"?`)) return;

    try {
      await deleteStudyItem(item.id);
      await refreshPrimeItems();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  }

  // ---------- RENDER ----------

  function renderList() {
    const visibleItems = showArchived
      ? studyItems.filter((i) => i.isArchived)
      : studyItems.filter((i) => !i.isArchived);

    PrimeView.renderList(
      visibleItems,
      {
        onLogPrime: handleLog,
        onEdit: (item) => PrimeView.openForEdit(item),
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToStudy: handleConvertToStudy,
        onConvertToReview: handleConvertToReview,
      },
      showArchived,
    );
  }

  // ---------- HEADER MENU ----------

  let headerMenu = null;

  function updateHeaderMenu() {
    if (headerMenu) headerMenu.dispose();

    headerMenu = createDropdownMenu({
      items: [
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

  // ---------- PUBLIC API ----------

  return {
    refresh: refreshPrimeItems,
    dispose() {
      headerMenu?.dispose();
    },
  };
}
