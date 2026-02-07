// controllers/study-controller.js
import { StudyItem } from "../domain/study-item.js";
import { StudyView } from "../views/study-view.js";
import { byId } from "../ui/ui-core.js";
import { studyIds } from "../ui/study-ids.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { CategoryManager } from "../utils/category-manager.js";
import { SoundManager } from "../utils/sound-manager.js";
import {
  createStudyItem,
  loadStudyItems,
  updateStudyItem,
  deleteStudyItem,
  logStudyItem,
  convertStudyToReview,
} from "../data/storage.js";

let studyItems = [];

export function createStudyController() {
  studyItems = [];
  let editingItemId = null;
  let showArchived = false;

  const modalCategoryInput = byId(studyIds.studyCategory);
  const modalCategoryDropdown = byId(studyIds.modalCategoryDropdown);
  const headerMenuBtn = byId(studyIds.headerMenuBtn);

  // Initialize category manager for modal
  const modalCategoryManager = new CategoryManager(
    modalCategoryInput,
    modalCategoryDropdown,
    null,
  );
  modalCategoryManager.loadCategories(studyItems);

  async function refreshStudyItems({ refreshCategories = true } = {}) {
    try {
      studyItems = await loadStudyItems();
    } catch (error) {
      console.error("Failed to load study items:", error);
      studyItems = [];
    }

    if (refreshCategories) {
      modalCategoryManager.loadCategories(studyItems);
    }

    renderList();
  }

  // Initial load
  void refreshStudyItems();

  // Handler functions
  const handleToggleArchived = () => {
    showArchived = !showArchived;
    renderList();
    updateHeaderMenu();
  };

  const handleCreateNew = () => {
    editingItemId = null;
    StudyView.openForCreate();
  };

  // Create header dropdown menu
  const getArchivedLabel = () =>
    showArchived ? "Hide Archived" : "Show Archived";

  const updateHeaderMenu = () => {
    if (headerMenu) {
      headerMenu.dispose();
    }

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

    if (!data.title) {
      alert("Please enter a title for this study item");
      return;
    }

    if (editingItemId) {
      try {
        await updateStudyItem(editingItemId, {
          title: data.title,
          category: data.category,
          description: data.description,
          notes: data.notes,
        });
        editingItemId = null;
        await refreshStudyItems({ refreshCategories: true });
      } catch (error) {
        console.error("Failed to update study item:", error);
        alert("Failed to update study item. Please try again.");
        return;
      }
    } else {
      const item = new StudyItem({
        title: data.title,
        category: data.category,
        description: data.description,
        notes: data.notes,
      });

      try {
        await createStudyItem(item.toJSON());
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
    const itemIndex = studyItems.findIndex((s) => s.id === item.id);
    if (itemIndex === -1) return;

    try {
      await logStudyItem(item.id);
    } catch (error) {
      console.error("Failed to log study:", error);
      alert("Failed to log study. Please try again.");
      return;
    }

    // Update local state
    studyItems[itemIndex].logStudy();

    // Play the sound
    SoundManager.play("studyLogged");

    // Add green border to the study item container immediately
    const studyItemContainer = document.querySelector(
      `.study-item[data-id="${item.id}"]`,
    );
    if (studyItemContainer) {
      studyItemContainer.classList.add("study-item--logged");
    }

    // Show brief confirmation on button
    const btn = byId(`log-study-${item.id}`);
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
      const newStudyItemContainer = document.querySelector(
        `.study-item[data-id="${item.id}"]`,
      );
      if (newStudyItemContainer) {
        newStudyItemContainer.classList.add("study-item--logged");

        setTimeout(() => {
          newStudyItemContainer.classList.remove("study-item--logged");
        }, 1000);
      }
    }, 1000);
  }

  function handleEdit(item) {
    editingItemId = item.id;
    StudyView.openForEdit(item);
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
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
        `Archive "${item.title}"? You can restore it later from archived items.`,
      )
    )
      return;

    try {
      await updateStudyItem(item.id, { archived: true });
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to archive study item:", error);
      alert("Failed to archive study item. Please try again.");
    }
  }

  async function handleRestore(item) {
    try {
      await updateStudyItem(item.id, { archived: false });
      await refreshStudyItems({ refreshCategories: true });
    } catch (error) {
      console.error("Failed to restore study item:", error);
      alert("Failed to restore study item. Please try again.");
    }
  }

  async function handleConvertToReview(item) {
    if (
      !confirm(
        `Convert "${item.title}" to a review item? The study item will be archived.`,
      )
    )
      return;

    const reviewItem = await convertStudyToReview(item.id);
    if (reviewItem) {
      await refreshStudyItems({ refreshCategories: true });
    } else {
      alert("Failed to convert study item. Please try again.");
    }
  }

  async function handleNotesUpdate(item, newNotes) {
    // Only update if notes actually changed
    if (item.notes === newNotes) return;

    try {
      await updateStudyItem(item.id, { notes: newNotes });
      // Update local state without re-rendering
      const itemIndex = studyItems.findIndex((s) => s.id === item.id);
      if (itemIndex !== -1) {
        studyItems[itemIndex].notes = newNotes;
      }
    } catch (error) {
      console.error("Failed to update notes:", error);
    }
  }

  function renderList() {
    // Filter items based on showArchived toggle
    const itemsToShow = showArchived
      ? studyItems.filter((item) => item.archived)
      : studyItems.filter((item) => !item.archived);

    StudyView.renderList(
      itemsToShow,
      {
        onLogStudy: handleLogStudy,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onArchive: showArchived ? handleRestore : handleArchive,
        onConvertToReview: handleConvertToReview,
        onNotesUpdate: handleNotesUpdate,
      },
      showArchived,
    );
  }

  // Return API for external use
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
