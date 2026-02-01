// controllers/prime-controller.js
import { PrimeItem } from "../domain/prime-item.js";
import { PrimeView } from "../views/prime-view.js";
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  createPrimeItem,
  loadPrimeItemsPage,
  logPrimeItem,
  updatePrimeItem,
  deletePrimeItem,
  convertPrimeToReview,
} from "../data/storage.js";

let primeItems = [];

export function createPrimeController({ initialPagePromise = null } = {}) {
  primeItems = [];
  let editingItemId = null;
  let showArchived = false;
  let renderCount = 6;
  let nextPrimeUrl = null;
  let isLoadingMore = false;
  let scrollObserver = null;
  let initialPageConsumed = false;

  const addPrimeBtn = byId(primeIds.addPrimeBtn);
  const quickAddInput = byId(primeIds.quickAddPrimeInput);
  const quickAddCategoryInput = byId(primeIds.quickAddCategoryInput);
  const categoryDropdown = byId(primeIds.categoryDropdown);
  const modalCategoryInput = byId(primeIds.primeCategory);
  const modalCategoryDropdown = byId(primeIds.modalCategoryDropdown);
  const headerMenuBtn = byId(primeIds.headerMenuBtn);
  const importPrimeFile = byId(primeIds.importPrimeFile);

  // Initialize category managers
  const quickAddCategoryManager = new CategoryManager(
    quickAddCategoryInput,
    categoryDropdown,
    null // No special action on select for quick add
  );
  quickAddCategoryManager.loadCategories(primeItems);

  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null // No special action on select for modal
  );
  modalCategoryManager.loadCategories(primeItems);

  const RENDER_BATCH_SIZE = 6;

  const updateCategories = () => {
    quickAddCategoryManager.loadCategories(primeItems);
    modalCategoryManager.loadCategories(primeItems);
  };

  const getVisiblePrimeItems = () =>
    showArchived
      ? primeItems.filter((item) => item.archived)
      : primeItems.filter((item) => !item.archived);

  async function loadNextPage() {
    if (isLoadingMore || !nextPrimeUrl) return false;
    isLoadingMore = true;
    try {
      const { items, next } = await loadPrimeItemsPage({ url: nextPrimeUrl });
      primeItems = primeItems.concat(items);
      nextPrimeUrl = next;
      return items.length > 0;
    } catch (error) {
      console.error("Failed to load more prime items:", error);
      return false;
    } finally {
      isLoadingMore = false;
    }
  }

  async function ensureVisibleItems(targetCount) {
    while (getVisiblePrimeItems().length < targetCount && nextPrimeUrl) {
      const loaded = await loadNextPage();
      if (!loaded) break;
    }
  }

  function setupInfiniteScroll() {
    if (scrollObserver) {
      scrollObserver.disconnect();
    }

    const sentinel = byId(primeIds.primeListSentinel);
    if (!sentinel) return;

    scrollObserver = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (isLoadingMore) return;
        renderCount += RENDER_BATCH_SIZE;
        await ensureVisibleItems(renderCount);
        updateCategories();
        renderList();
      },
      { root: null, rootMargin: "100% 0px", threshold: 0 }
    );

    scrollObserver.observe(sentinel);
  }

  async function refreshPrimeItems({ refreshCategories = true } = {}) {
    primeItems = [];
    renderCount = RENDER_BATCH_SIZE;
    nextPrimeUrl = null;
    PrimeView.resetRenderState();
    renderList({ forceFullRender: true, isLoading: true });

    try {
      const initialPage =
        initialPagePromise && !initialPageConsumed
          ? await initialPagePromise
          : null;
      initialPageConsumed = true;

      const { items, next } = initialPage || (await loadPrimeItemsPage());
      primeItems = items;
      nextPrimeUrl = next;
      await ensureVisibleItems(renderCount);
    } catch (error) {
      console.error("Failed to load prime items:", error);
      primeItems = [];
      nextPrimeUrl = null;
    }

    if (refreshCategories) {
      updateCategories();
    }

    renderList({ forceFullRender: true, isLoading: false });
  }

  // Initial load
  void refreshPrimeItems();

  // Handler functions (defined before being used in menu)
  // Toggle archived items visibility
  const handleToggleArchived = async () => {
    showArchived = !showArchived;
    renderCount = RENDER_BATCH_SIZE;
    PrimeView.resetRenderState();
    await ensureVisibleItems(renderCount);
    renderList({ forceFullRender: true });
    updateHeaderMenu();
  };

  // Trigger file input when import clicked
  const handleImportClick = () => {
    importPrimeFile.click();
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
      alert("Please enter a title for this prime item");
      quickAddInput.focus();
      return;
    }

    const item = new PrimeItem({ title, category });

    try {
      await createPrimeItem(item.toJSON());
      quickAddInput.classList.add("submitted");
      setTimeout(() => quickAddInput.classList.remove("submitted"), 1000);
      await refreshPrimeItems({ refreshCategories: true });
    } catch (error) {
      quickAddInput.classList.add("failed");
      setTimeout(() => quickAddInput.classList.remove("failed"), 1000);
      return;
    }

    // Clear inputs and render
    quickAddInput.value = "";
    quickAddCategoryInput.value = "";
    quickAddInput.style.height = "auto";
    quickAddInput.focus();
  };

  addPrimeBtn.addEventListener("click", handleQuickAdd);

  // Auto-expand textarea as user types
  const autoExpandTextarea = () => {
    quickAddInput.style.height = "auto";
    quickAddInput.style.height = quickAddInput.scrollHeight + "px";
  };

  quickAddInput.addEventListener("input", autoExpandTextarea);

  // Allow Ctrl/Cmd+Enter to add prime item, Enter alone for new lines
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
          "No prime items found. Make sure lines start with #### for titles."
        );
        return;
      }

      const newItems = importedItems.map(
        (title) => new PrimeItem({ title, category })
      );
      await Promise.all(newItems.map((item) => createPrimeItem(item.toJSON())));
      await refreshPrimeItems({ refreshCategories: true });

      const categoryMsg = category ? ` with category "${category}"` : "";
      alert(
        `Successfully imported ${importedItems.length} prime item(s)${categoryMsg}!`
      );

      // Reset file input
      importPrimeFile.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import file. Please try again.");
    }
  };

  importPrimeFile.addEventListener("change", handleFileImport);

  // Bind modal form
  const unbindModal = PrimeView.bind({
    onSave: handleSave,
    onCancel: handleCancel,
  });

  async function handleSave() {
    const data = PrimeView.readFormData();

    if (!data.title) {
      alert("Please enter a title for this prime item");
      return;
    }

    if (editingItemId) {
      try {
        await updatePrimeItem(editingItemId, {
          title: data.title,
          category: data.category,
          description: data.description,
        });
        editingItemId = null;
        await refreshPrimeItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to update prime item:", error);
        alert("Failed to update prime item. Please try again.");
        return;
      }
    } else {
      const item = new PrimeItem({
        title: data.title,
        category: data.category,
        description: data.description,
      });

      try {
        await createPrimeItem(item.toJSON());
        await refreshPrimeItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to create prime item:", error);
        alert("Failed to create prime item. Please try again.");
        return;
      }
    }

    PrimeView.close();
  }

  function handleCancel() {
    editingItemId = null;
    PrimeView.close();
  }

  async function handleLogPrime(item) {
    const itemIndex = primeItems.findIndex((p) => p.id === item.id);
    if (itemIndex === -1) return;

    try {
      const updatedItem = await logPrimeItem(item.id);
      primeItems[itemIndex] = updatedItem;
    } catch (error) {
      console.error("Failed to log prime:", error);
      alert("Failed to log prime. Please try again.");
      return;
    }

    // Play the sound
    SoundManager.play("primeLogged");

    // Add green border to the prime item container immediately
    const primeItemContainer = document.querySelector(
      `.prime-item[data-id="${item.id}"]`
    );
    if (primeItemContainer) {
      primeItemContainer.classList.add("prime-item--logged");
    }

    // Show brief confirmation on button
    const btn = byId(`log-prime-${item.id}`);
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
      renderList({ forceFullRender: true });

      // Re-apply green border after render (item may have moved)
      const newPrimeItemContainer = document.querySelector(
        `.prime-item[data-id="${item.id}"]`
      );
      if (newPrimeItemContainer) {
        newPrimeItemContainer.classList.add("prime-item--logged");

        setTimeout(() => {
          newPrimeItemContainer.classList.remove("prime-item--logged");
        }, 1000);
      }
    }, 1000);
  }

  function handleEdit(item) {
    editingItemId = item.id;
    PrimeView.openForEdit(item);
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await deletePrimeItem(item.id);
      await refreshPrimeItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to delete prime item:", error);
      alert("Failed to delete prime item. Please try again.");
    }
  }

  async function handleArchive(item) {
    if (
      !confirm(
        `Archive "${item.title}"? You can restore it later from archived items.`
      )
    )
      return;
    try {
      await updatePrimeItem(item.id, { archived: true });
      await refreshPrimeItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to archive prime item:", error);
      alert("Failed to archive prime item. Please try again.");
    }
  }

  async function handleRestore(item) {
    try {
      await updatePrimeItem(item.id, { archived: false });
      await refreshPrimeItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to restore prime item:", error);
      alert("Failed to restore prime item. Please try again.");
    }
  }

  async function handleConvertToReview(item) {
    if (
      !confirm(
        `Convert "${item.title}" to a review item? The original prime item will be archived.`
      )
    )
      return;
    const reviewItem = await convertPrimeToReview(item.id);
    if (reviewItem) {
      await refreshPrimeItems({ refreshCategories: true });
    } else {
      alert("Failed to convert prime item. Please try again.");
    }
  }

  function renderList({ forceFullRender = false, isLoading = false } = {}) {
    // Filter items based on showArchived toggle
    const itemsToShow = getVisiblePrimeItems();
    const hasMore = itemsToShow.length > renderCount || Boolean(nextPrimeUrl);

    PrimeView.renderList(
      itemsToShow,
      {
        onLogPrime: handleLogPrime,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToReview: handleConvertToReview,
      },
      showArchived,
      { limit: renderCount, showSentinel: hasMore, forceFullRender, isLoading }
    );

    if (hasMore && !isLoading) {
      setupInfiniteScroll();
    } else if (scrollObserver) {
      scrollObserver.disconnect();
    }
  }

  /**
   * Parse import file and extract titles from lines starting with ####
   * Optionally extract category from first line if it matches "Category: value" or "category: value"
   * @param {string} text - File contents
   * @returns {{ items: string[], category: string }} - Object with array of prime item titles and optional category
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
        startIndex = 1; // Skip first line when processing items
      }
    }

    // Process lines starting from the appropriate index
    for (let i = startIndex; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("####")) {
        // Remove the #### prefix and any extra whitespace
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
    getPrimeItems: () => [...primeItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      addPrimeBtn.removeEventListener("click", handleQuickAdd);
      importPrimeFile.removeEventListener("change", handleFileImport);
      headerMenu?.dispose();
      scrollObserver?.disconnect();
      quickAddCategoryManager?.dispose();
      modalCategoryManager?.dispose();
    },
  };
}
