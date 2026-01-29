// controllers/review-controller.js
import { ReviewItem } from "../domain/review-item.js";
import { ReviewView } from "../views/review-view.js";
import { byId } from "../ui/ui-core.js";
import { reviewIds } from "../ui/review-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  createReviewItem,
  loadReviewItems,
  updateReviewItem,
  deleteReviewItem,
} from "../data/storage.js";

let reviewItems = [];

export function createReviewController() {
  reviewItems = [];
  let editingItemId = null;
  let showArchived = false;

  const addReviewBtn = byId(reviewIds.addReviewBtn);
  const quickAddInput = byId(reviewIds.quickAddReviewInput);
  const quickAddCategoryInput = byId(reviewIds.quickAddCategoryInput);
  const categoryDropdown = byId(reviewIds.categoryDropdown);
  const modalCategoryInput = byId(reviewIds.reviewCategory);
  const modalCategoryDropdown = byId(reviewIds.modalCategoryDropdown);
  const headerMenuBtn = byId(reviewIds.headerMenuBtn);
  const importReviewFile = byId(reviewIds.importReviewFile);

  // Initialize category managers
  const quickAddCategoryManager = new CategoryManager(
    quickAddCategoryInput,
    categoryDropdown,
    null,
  );
  quickAddCategoryManager.loadCategories(reviewItems);

  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null,
  );
  modalCategoryManager.loadCategories(reviewItems);

  async function refreshReviewItems({ refreshCategories = true } = {}) {
    try {
      reviewItems = await loadReviewItems();
    } catch (error) {
      console.error("Failed to load review items:", error);
      reviewItems = [];
    }

    if (refreshCategories) {
      quickAddCategoryManager.loadCategories(reviewItems);
      modalCategoryManager.loadCategories(reviewItems);
    }

    renderList();
  }

  // Initial load
  void refreshReviewItems();

  // Handler functions
  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList();
    updateHeaderMenu();
  };

  const handleImportClick = () => {
    importReviewFile.click();
  };

  // Create header dropdown menu
  const getHeaderMenuLabel = () =>
    showArchived ? "Hide Archived" : "Show Archived";

  const updateHeaderMenu = () => {
    if (headerMenu) {
      headerMenu.dispose();
    }

    const menuItems = [
      { label: getHeaderMenuLabel(), onSelect: handleToggleArchived },
      { label: "Import from File", onSelect: handleImportClick },
    ];

    headerMenu = createDropdownMenu({ items: menuItems });
    headerMenu.attachTo(headerMenuBtn);
  };

  let headerMenu = null;
  updateHeaderMenu();

  // Quick-add from input field
  const handleQuickAdd = async () => {
    const title = quickAddInput.value.trim();
    const category = quickAddCategoryInput.value.trim();

    if (!title) {
      alert("Please enter a title for this review item");
      quickAddInput.focus();
      return;
    }

    const item = new ReviewItem({ title, category });

    try {
      await createReviewItem(item.toJSON());
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to add review item:", error);
      alert("Failed to add review item. Please try again.");
      return;
    }

    // Clear inputs and render
    quickAddInput.value = "";
    quickAddCategoryInput.value = "";
    quickAddInput.style.height = "auto";
    quickAddInput.focus();
  };

  addReviewBtn.addEventListener("click", handleQuickAdd);

  // Auto-expand textarea as user types
  const autoExpandTextarea = () => {
    quickAddInput.style.height = "auto";
    quickAddInput.style.height = quickAddInput.scrollHeight + "px";
  };

  quickAddInput.addEventListener("input", autoExpandTextarea);

  // Allow Ctrl/Cmd+Enter to add review item, Enter alone for new lines
  quickAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleQuickAdd();
    }
  });

  // Handle file selection and import
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { items: importedItems, category } = parseImportFile(text);

      if (importedItems.length === 0) {
        alert(
          "No review items found. Make sure lines start with #### for titles.",
        );
        return;
      }

      const newItems = importedItems.map(
        (title) => new ReviewItem({ title, category }),
      );
      await Promise.all(
        newItems.map((item) => createReviewItem(item.toJSON())),
      );
      await refreshReviewItems({ refreshCategories: true });

      const categoryMsg = category ? ` with category "${category}"` : "";
      alert(
        `Successfully imported ${importedItems.length} review item(s)${categoryMsg}!`,
      );

      // Reset file input
      importReviewFile.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import file. Please try again.");
    }
  };

  importReviewFile.addEventListener("change", handleFileImport);

  // Bind modal form
  const unbindModal = ReviewView.bind({
    onSave: handleSave,
    onCancel: handleCancel,
  });

  async function handleSave() {
    const data = ReviewView.readFormData();

    if (!data.title) {
      alert("Please enter a title for this review item");
      return;
    }

    if (editingItemId) {
      try {
        await updateReviewItem(editingItemId, {
          title: data.title,
          category: data.category,
          description: data.description,
        });
        editingItemId = null;
        await refreshReviewItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to update review item:", error);
        alert("Failed to update review item. Please try again.");
        return;
      }
    } else {
      const item = new ReviewItem({
        title: data.title,
        category: data.category,
        description: data.description,
      });

      try {
        await createReviewItem(item.toJSON());
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
    const itemIndex = reviewItems.findIndex((r) => r.id === item.id);
    if (itemIndex === -1) return;

    reviewItems[itemIndex].logReview();
    const nextReviewTimestamps = [
      ...(reviewItems[itemIndex].reviewTimestamps || []),
    ];
    const nextFirstStudiedAt = reviewItems[itemIndex].firstStudiedAt ?? null;

    try {
      await updateReviewItem(item.id, {
        reviewTimestamps: nextReviewTimestamps,
        firstStudiedAt: nextFirstStudiedAt,
      });
    } catch (error) {
      console.error("Failed to log review:", error);
      alert("Failed to log review. Please try again.");
      return;
    }

    // Play the sound
    SoundManager.play("reviewLogged");

    // Add green border to the review item container immediately
    const reviewItemContainer = document.querySelector(
      `.review-item[data-id="${item.id}"]`,
    );
    if (reviewItemContainer) {
      reviewItemContainer.classList.add("review-item--logged");
    }

    // Show brief confirmation on button
    const btn = byId(`log-review-${item.id}`);
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = "Logged! ✓";
      btn.disabled = true;

      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1000);
    }

    // Wait 1 second before re-rendering to move item and update stats
    setTimeout(() => {
      renderList();

      // Re-apply green border after render (item may have moved)
      const newReviewItemContainer = document.querySelector(
        `.review-item[data-id="${item.id}"]`,
      );
      if (newReviewItemContainer) {
        newReviewItemContainer.classList.add("review-item--logged");

        setTimeout(() => {
          newReviewItemContainer.classList.remove("review-item--logged");
        }, 1000);
      }
    }, 1000);
  }

  function handleEdit(item) {
    editingItemId = item.id;
    ReviewView.openForEdit(item);
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteReviewItem(item.id);
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to delete review item:", error);
      alert("Failed to delete review item. Please try again.");
    }
  }

  async function handleArchive(item) {
    if (
      !confirm(
        `Archive "${item.title}"? You can restore it later from archived items.`,
      )
    )
      return;

    try {
      await updateReviewItem(item.id, { archived: true });
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to archive review item:", error);
      alert("Failed to archive review item. Please try again.");
    }
  }

  async function handleRestore(item) {
    try {
      await updateReviewItem(item.id, { archived: false });
      await refreshReviewItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to restore review item:", error);
      alert("Failed to restore review item. Please try again.");
    }
  }

  function renderList() {
    // Filter items based on showArchived toggle
    const itemsToShow = showArchived
      ? reviewItems.filter((item) => item.archived)
      : reviewItems.filter((item) => !item.archived);

    ReviewView.renderList(
      itemsToShow,
      {
        onLogReview: handleLogReview,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
      },
      showArchived,
    );
  }

  /**
   * Parse import file and extract titles from lines starting with ####
   * Optionally extract category from first line if it matches "Category: value" or "category: value"
   * @param {string} text - File contents
   * @returns {{ items: string[], category: string }} - Object with array of review item titles and optional category
   */
  function parseImportFile(text) {
    const lines = text.split("\n");
    const titles = [];
    let category = "";
    let startIndex = 0;

    // Check if first line declares a category (case-insensitive)
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const categoryMatch = firstLine.match(/^category:\s*(.+)$/i);
      if (categoryMatch) {
        category = categoryMatch[1].trim();
        startIndex = 1;
      }
    }

    // Process lines starting from the appropriate index
    for (let i = startIndex; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("####")) {
        const title = trimmed.substring(4).trim();
        if (title) {
          titles.push(title);
        }
      }
    }

    return { items: titles, category };
  }

  // Return API for external use
  return {
    getReviewItems: () => [...reviewItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      addReviewBtn.removeEventListener("click", handleQuickAdd);
      importReviewFile.removeEventListener("change", handleFileImport);
      headerMenu?.dispose();
      quickAddCategoryManager?.dispose();
      modalCategoryManager?.dispose();
    },
  };
}
