import { StudyItem } from "../domain/study-item.js";
import { ReviewView } from "../views/review-view.js";
import { byId } from "../ui/ui-core.js";
import { reviewIds } from "../ui/review-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createCategoryFilterModal } from "../views/components/category-filter-modal.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  createStudyItem,
  loadStudyItems,
  updateStudyItem,
  deleteStudyItem,
  logInteraction,
  transitionToStudying,
  transitionToPriming,
  loadCategories,
} from "../api/studyItemApi.js";

let reviewItems = [];

export function createReviewController() {
  const CATEGORY_FILTER_KEY = "reviewCategoryFilter";

  reviewItems = [];
  let editingItemId = null;
  let showArchived = false;
  let currentCategoryFilter = localStorage.getItem(CATEGORY_FILTER_KEY) || "";

  const modalCategoryInput = byId(reviewIds.reviewCategory);
  const modalCategoryDropdown = byId(reviewIds.modalCategoryDropdown);
  const headerMenuBtn = byId(reviewIds.headerMenuBtn);

  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null,
  );

  async function refreshCategories() {
    try {
      const categories = await loadCategories({ mode: "reviewing" });
      modalCategoryManager.setCategories(categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }

  async function refreshReviewItems({
    refreshCategories: shouldRefresh = true,
  } = {}) {
    try {
      const data = await loadStudyItems({
        mode: "reviewing",
        category: currentCategoryFilter || undefined,
      });
      reviewItems = data.map((item) => StudyItem.fromJSON(item));
    } catch (error) {
      console.error("Failed to load review items:", error);
      reviewItems = [];
    }

    if (shouldRefresh) {
      await refreshCategories();
    }

    renderList();
  }

  function resetAndLoad() {
    reviewItems = [];
    void refreshReviewItems({ refreshCategories: false });
  }

  // Initial load
  void refreshReviewItems();

  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList();
    updateHeaderMenu();
  };

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

    const filterLabel = currentCategoryFilter
      ? `Category: ${currentCategoryFilter}`
      : "Filter by Category";

    headerMenu = createDropdownMenu({
      items: [
        {
          label: filterLabel,
          onSelect: async () => {
            const categories = await loadCategories({ mode: "reviewing" }).catch(() => []);
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
          label: showArchived ? "Hide Archived" : "Show Archived",
          onSelect: handleToggleArchived,
        },
      ],
    });

    headerMenu.attachTo(headerMenuBtn);
  };

  let headerMenu = null;
  updateHeaderMenu();

  const unbindModal = ReviewView.bind({
    onSave: handleSave,
    onCancel: handleCancel,
  });

  async function handleSave() {
    const data = ReviewView.readFormData();

    if (!data.prompt) {
      alert("Please enter a title for this review item");
      return;
    }

    if (editingItemId) {
      try {
        await updateStudyItem(editingItemId, {
          prompt: data.prompt,
          category: data.category,
          notes: data.notes,
        });
        editingItemId = null;
        await refreshReviewItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to update review item:", error);
        alert("Failed to update review item. Please try again.");
        return;
      }
    } else {
      try {
        await createStudyItem({
          prompt: data.prompt,
          category: data.category,
          notes: data.notes || "",
          is_priming: false,
          is_studying: false,
          is_reviewing: true,
        });
        await refreshReviewItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to create review item:", error);
        alert("Failed to create review item. Please try again.");
        return;
      }
    }

    ReviewView.close();
  }

  function handleCancel() {
    editingItemId = null;
    ReviewView.close();
  }

  async function handleLogReview(item) {
    try {
      const updated = await logInteraction(item.id);
      SoundManager.play("reviewLogged");

      const index = reviewItems.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        reviewItems[index] = StudyItem.fromJSON(updated);
      }

      queueMicrotask(() => renderList());
    } catch (error) {
      console.error("Failed to log review:", error);
      alert("Failed to log review. Please try again.");
    }
  }

  function handleEdit(item) {
    editingItemId = item.id;
    ReviewView.openForEdit(item);
  }

  async function handleDelete(item) {
    try {
      await deleteStudyItem(item.id);
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to delete review item:", error);
      alert("Failed to delete review item. Please try again.");
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
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to archive review item:", error);
      alert("Failed to archive review item. Please try again.");
    }
  }

  async function handleRestore(item) {
    try {
      await updateStudyItem(item.id, { is_archived: false });
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to restore review item:", error);
      alert("Failed to restore review item. Please try again.");
    }
  }

  async function handleConvertToStudy(item) {
    try {
      await transitionToStudying(item.id);
      reviewItems = reviewItems.filter((i) => i.id !== item.id);
      renderList();
    } catch (error) {
      console.error("Failed to convert review item:", error);
      alert("Failed to convert review item. Please try again.");
    }
  }

  async function handleConvertToPriming(item) {
    try {
      await transitionToPriming(item.id);
      reviewItems = reviewItems.filter((i) => i.id !== item.id);
      renderList();
    } catch (error) {
      console.error("Failed to convert review item:", error);
      alert("Failed to convert review item. Please try again.");
    }
  }

  function renderList() {
    const itemsToShow = showArchived
      ? reviewItems.filter((item) => item.isArchived)
      : reviewItems.filter((item) => !item.isArchived);

    ReviewView.renderList(
      itemsToShow,
      {
        onLogReview: handleLogReview,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToStudy: handleConvertToStudy,
        onConvertToPriming: handleConvertToPriming,
      },
      showArchived,
    );
  }

  return {
    getReviewItems: () => [...reviewItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      headerMenu?.dispose();
      modalCategoryManager?.dispose();
      categoryFilterModal.dispose();
    },
  };
}
