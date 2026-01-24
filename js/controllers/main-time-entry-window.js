import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";
import { createDataManagementMenu } from "./data-management-controller.js";

export function createMainTimeEntryWindowController(options = {}) {
  const { onManualEntrySaved } = options;

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

    menu = createDropdownMenu({
      items: [
        {
          label: "Add manual time entry",
          onSelect: () => {
            manualEntryModal.open();
          },
        },
        ...dataMenu.items,
      ],
    });

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
