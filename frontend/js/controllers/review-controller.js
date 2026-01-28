// controllers/review-controller.js
import { ReviewItem } from "../domain/review-item.js";
import { ReviewView } from "../views/review-view.js";
import { byId } from "../ui/ui-core.js";
import { reviewIds } from "../ui/review-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  saveReviewItems,
  loadReviewItems,
  updateReviewItem,
  deleteReviewItem,
} from "../data/storage.js";

let reviewItems = [];

export function createReviewController() {
  reviewItems = loadReviewItems();
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
    null
  );
  quickAddCategoryManager.loadCategories(reviewItems);

  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null
  );
  modalCategoryManager.loadCategories(reviewItems);

  // Initial render
  renderList();

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
  const getHeaderMenuLabel = () => showArchived ? "Hide Archived" : "Show Archived";
  
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
  const handleQuickAdd = () => {
    const title = quickAddInput.value.trim();
    const category = quickAddCategoryInput.value.trim();
    
    if (!title) {
      alert("Please enter a title for this review item");
      quickAddInput.focus();
      return;
    }

    // Create new item
    const item = new ReviewItem({ title, category });
    const next = loadReviewItems();
    next.push(item);
    saveReviewItems(next);
    reviewItems = next;

    // Update category manager with new category
    if (category) {
      quickAddCategoryManager.incrementCategory(category);
      modalCategoryManager.incrementCategory(category);
    }

    // Clear inputs and render
    quickAddInput.value = "";
    quickAddCategoryInput.value = "";
    quickAddInput.style.height = 'auto';
    quickAddInput.focus();
    renderList();
  };

  addReviewBtn.addEventListener("click", handleQuickAdd);
  
  // Auto-expand textarea as user types
  const autoExpandTextarea = () => {
    quickAddInput.style.height = 'auto';
    quickAddInput.style.height = quickAddInput.scrollHeight + 'px';
  };

  quickAddInput.addEventListener('input', autoExpandTextarea);
  
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
        alert("No review items found. Make sure lines start with #### for titles.");
        return;
      }

      // Load current items and add imported ones
      const currentItems = loadReviewItems();
      const newItems = importedItems.map(title => new ReviewItem({ title, category }));
      const combined = [...currentItems, ...newItems];
      
      saveReviewItems(combined);
      reviewItems = loadReviewItems();
      
      // Update category managers if a category was imported
      if (category) {
        quickAddCategoryManager.loadCategories(reviewItems);
        modalCategoryManager.loadCategories(reviewItems);
      }
      
      renderList();

      const categoryMsg = category ? ` with category "${category}"` : "";
      alert(`Successfully imported ${importedItems.length} review item(s)${categoryMsg}!`);
      
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

  function handleSave() {
    const data = ReviewView.readFormData();

    if (!data.title) {
      alert("Please enter a title for this review item");
      return;
    }

    if (editingItemId) {
      // Update existing item
      const success = updateReviewItem(editingItemId, {
        title: data.title,
        category: data.category,
        description: data.description,
      });

      if (success) {
        reviewItems = loadReviewItems();
        
        // Update category managers if category changed
        if (data.category) {
          quickAddCategoryManager.loadCategories(reviewItems);
          modalCategoryManager.loadCategories(reviewItems);
        }
        
        renderList();
      }

      editingItemId = null;
    } else {
      // Create new item
      const item = new ReviewItem({
        title: data.title,
        category: data.category,
        description: data.description,
      });

      const next = loadReviewItems();
      next.push(item);
      saveReviewItems(next);
      reviewItems = next;

      // Update category managers with new category
      if (data.category) {
        quickAddCategoryManager.incrementCategory(data.category);
        modalCategoryManager.incrementCategory(data.category);
      }

      renderList();
    }

    ReviewView.close();
  }

  function handleCancel() {
    editingItemId = null;
    ReviewView.close();
  }

  function handleLogReview(item) {
    // Find the item and log a review
    const itemIndex = reviewItems.findIndex((r) => r.id === item.id);
    if (itemIndex === -1) return;

    reviewItems[itemIndex].logReview();
    saveReviewItems(reviewItems);

    // Play the sound
    SoundManager.play("reviewLogged");

    // Add green border to the review item container immediately
    const reviewItemContainer = document.querySelector(`.review-item[data-id="${item.id}"]`);
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
      const newReviewItemContainer = document.querySelector(`.review-item[data-id="${item.id}"]`);
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

  function handleDelete(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;

    const success = deleteReviewItem(item.id);
    if (success) {
      reviewItems = loadReviewItems();
      renderList();
    }
  }

  function handleArchive(item) {
    if (!confirm(`Archive "${item.title}"? You can restore it later from archived items.`)) return;

    const success = updateReviewItem(item.id, { archived: true });
    if (success) {
      reviewItems = loadReviewItems();
      renderList();
    }
  }

  function handleRestore(item) {
    const success = updateReviewItem(item.id, { archived: false });
    if (success) {
      reviewItems = loadReviewItems();
      renderList();
    }
  }

  function renderList() {
    // Filter items based on showArchived toggle
    const itemsToShow = showArchived 
      ? reviewItems.filter(item => item.archived)
      : reviewItems.filter(item => !item.archived);
    
    ReviewView.renderList(itemsToShow, {
      onLogReview: handleLogReview,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onArchive: showArchived ? handleRestore : handleArchive,
    }, showArchived);
  }

  /**
   * Parse import file and extract titles from lines starting with ####
   * Optionally extract category from first line if it matches "Category: value" or "category: value"
   * @param {string} text - File contents
   * @returns {{ items: string[], category: string }} - Object with array of review item titles and optional category
   */
  function parseImportFile(text) {
    const lines = text.split('\n');
    const titles = [];
    let category = '';
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
      if (trimmed.startsWith('####')) {
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
