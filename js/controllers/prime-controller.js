// controllers/prime-controller.js
import { PrimeItem } from "../domain/prime-item.js";
import { PrimeView } from "../views/prime-view.js";
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  savePrimeItems,
  loadPrimeItems,
  updatePrimeItem,
  deletePrimeItem,
} from "../data/storage.js";

let primeItems = [];

export function createPrimeController() {
  primeItems = loadPrimeItems();
  let editingItemId = null;
  let showArchived = false;

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

  // Initial render
  renderList();

  // Handler functions (defined before being used in menu)
  // Toggle archived items visibility
  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList();
    updateHeaderMenu();
  };

  // Trigger file input when import clicked
  const handleImportClick = () => {
    importPrimeFile.click();
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
      alert("Please enter a title for this prime item");
      quickAddInput.focus();
      return;
    }

    // Create new item
    const item = new PrimeItem({ title, category });
    const next = loadPrimeItems();
    next.push(item);
    savePrimeItems(next);
    primeItems = next;

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

  addPrimeBtn.addEventListener("click", handleQuickAdd);
  
  // Auto-expand textarea as user types
  const autoExpandTextarea = () => {
    quickAddInput.style.height = 'auto';
    quickAddInput.style.height = quickAddInput.scrollHeight + 'px';
  };

  quickAddInput.addEventListener('input', autoExpandTextarea);
  
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
        alert("No prime items found. Make sure lines start with #### for titles.");
        return;
      }

      // Load current items and add imported ones
      const currentItems = loadPrimeItems();
      const newItems = importedItems.map(title => new PrimeItem({ title, category }));
      const combined = [...currentItems, ...newItems];
      
      savePrimeItems(combined);
      primeItems = loadPrimeItems();
      
      // Update category managers if a category was imported
      if (category) {
        quickAddCategoryManager.loadCategories(primeItems);
        modalCategoryManager.loadCategories(primeItems);
      }
      
      renderList();

      const categoryMsg = category ? ` with category "${category}"` : "";
      alert(`Successfully imported ${importedItems.length} prime item(s)${categoryMsg}!`);
      
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

  function handleSave() {
    const data = PrimeView.readFormData();

    if (!data.title) {
      alert("Please enter a title for this prime item");
      return;
    }

    if (editingItemId) {
      // Update existing item
      const success = updatePrimeItem(editingItemId, {
        title: data.title,
        category: data.category,
        description: data.description,
      });

      if (success) {
        primeItems = loadPrimeItems();
        
        // Update category managers if category changed
        if (data.category) {
          quickAddCategoryManager.loadCategories(primeItems);
          modalCategoryManager.loadCategories(primeItems);
        }
        
        renderList();
      }

      editingItemId = null;
    } else {
      // Create new item
      const item = new PrimeItem({
        title: data.title,
        category: data.category,
        description: data.description,
      });

      const next = loadPrimeItems();
      next.push(item);
      savePrimeItems(next);
      primeItems = next;

      // Update category managers with new category
      if (data.category) {
        quickAddCategoryManager.incrementCategory(data.category);
        modalCategoryManager.incrementCategory(data.category);
      }

      renderList();
    }

    PrimeView.close();
  }

  function handleCancel() {
    editingItemId = null;
    PrimeView.close();
  }

  function handleLogPrime(item) {
    // Find the item and log a prime
    const itemIndex = primeItems.findIndex((p) => p.id === item.id);
    if (itemIndex === -1) return;

    primeItems[itemIndex].logPrime();
    savePrimeItems(primeItems);

    // Play the sound
    SoundManager.play("primeLogged");

    // Show brief confirmation
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

    // Re-render to update stats
    renderList();
  }

  function handleEdit(item) {
    editingItemId = item.id;
    PrimeView.openForEdit(item);
  }

  function handleDelete(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;

    const success = deletePrimeItem(item.id);
    if (success) {
      primeItems = loadPrimeItems();
      renderList();
    }
  }

  function handleArchive(item) {
    if (!confirm(`Archive "${item.title}"? You can restore it later from archived items.`)) return;

    const success = updatePrimeItem(item.id, { archived: true });
    if (success) {
      primeItems = loadPrimeItems();
      renderList();
    }
  }

  function handleRestore(item) {
    const success = updatePrimeItem(item.id, { archived: false });
    if (success) {
      primeItems = loadPrimeItems();
      renderList();
    }
  }

  function renderList() {
    // Filter items based on showArchived toggle
    const itemsToShow = showArchived 
      ? primeItems.filter(item => item.archived)
      : primeItems.filter(item => !item.archived);
    
    PrimeView.renderList(itemsToShow, {
      onLogPrime: handleLogPrime,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onArchive: showArchived ? handleRestore : handleArchive,
    }, showArchived);
  }

  /**
   * Parse import file and extract titles from lines starting with ####
   * Optionally extract category from first line if it matches "Category: value" or "category: value"
   * @param {string} text - File contents
   * @returns {{ items: string[], category: string }} - Object with array of prime item titles and optional category
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
        startIndex = 1; // Skip first line when processing items
      }
    }

    // Process lines starting from the appropriate index
    for (let i = startIndex; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('####')) {
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
      quickAddCategoryManager?.dispose();
      modalCategoryManager?.dispose();
    },
  };
}
