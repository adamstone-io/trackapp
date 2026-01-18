import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createManualTimeEntryModal } from "../views/components/manual-time-entry-modal.js"


export function createMainTimeEntryWindowController(options = {}) {
  const { onManualEntrySaved } = options;

  const menuButton = document.getElementById("timer-menu-btn");
  let menu = null;
  let manualEntryModal = null;

  init();

  function init() {
    if (!menuButton) return;

    manualEntryModal = createManualTimeEntryModal({
        onSave: onManualEntrySaved,
    });

    menu = createDropdownMenu({
      items: [
        {
          label: "Add manual time entry",
          onSelect: () => {
            manualEntryModal.open();
          },
        },
      ],
    });

    menu.attachTo(menuButton);
  }

  function dispose() {
    menu?.dispose();
  }

  return {
    dispose,
  };
}
