// controllers/prime-controller.js
import { PrimeItem } from "../domain/prime-item.js";
import { PrimeView } from "../views/prime-view.js";
import { byId } from "../ui/ui-core.js";
import { primeIds } from "../ui/prime-ids.js";
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
  const showArchivedBtn = byId(primeIds.showArchivedBtn);

  // Initial render
  renderList();

  // Open modal for creating new item
  const handleOpenCreate = () => {
    editingItemId = null;
    PrimeView.openForCreate();
  };

  addPrimeBtn.addEventListener("click", handleOpenCreate);

  // Toggle archived items visibility
  const handleToggleArchived = () => {
    showArchived = !showArchived;
    showArchivedBtn.textContent = showArchived ? "Hide Archived" : "Show Archived";
    renderList();
  };

  showArchivedBtn.addEventListener("click", handleToggleArchived);

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
        description: data.description,
      });

      if (success) {
        primeItems = loadPrimeItems();
        renderList();
      }

      editingItemId = null;
    } else {
      // Create new item
      const item = new PrimeItem({
        title: data.title,
        description: data.description,
      });

      const next = loadPrimeItems();
      next.push(item);
      savePrimeItems(next);
      primeItems = next;

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

  // Return API for external use
  return {
    getPrimeItems: () => [...primeItems],
    refresh: renderList,
    dispose: () => {
      unbindModal();
      addPrimeBtn.removeEventListener("click", handleOpenCreate);
      showArchivedBtn.removeEventListener("click", handleToggleArchived);
    },
  };
}
