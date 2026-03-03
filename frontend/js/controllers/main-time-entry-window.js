import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";
import { createDataManagementMenu } from "./data-management-controller.js";

export function createMainTimeEntryWindowController(options = {}) {
  const { onManualEntrySaved, onAddMoment } = options;

  const menuButton = document.getElementById("timer-menu-btn");
  let menu = null;
  let manualEntryModal = null;
  let dataMenu = null;

  init();

  function init() {
    if (!menuButton) return;

    manualEntryModal = createTimeEntryModal({
      onSave: onManualEntrySaved,
    });

    dataMenu = createDataManagementMenu();

    const items = [
      {
        label: "Add manual time entry",
        onSelect: () => {
          manualEntryModal.open();
        },
      },
    ];

    if (typeof onAddMoment === "function") {
      items.push({
        label: "Add manual moment",
        onSelect: () => onAddMoment(""),
      });
    }

    items.push(...dataMenu.items);

    menu = createDropdownMenu({ items });

    menu.attachTo(menuButton);
  }

  function dispose() {
    menu?.dispose();
    dataMenu?.dispose();
  }

  return {
    dispose,
  };
}
