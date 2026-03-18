import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";
import { createDataManagementMenu } from "./data-management-controller.js";

const TIMER_DEFAULT_MODE_KEY = "timerDefaultMode";

export function getTimerDefaultMode() {
  return localStorage.getItem(TIMER_DEFAULT_MODE_KEY) || "stopwatch";
}

function setTimerDefaultMode(mode) {
  localStorage.setItem(TIMER_DEFAULT_MODE_KEY, mode);
}

export function createMainTimeEntryWindowController(options = {}) {
  const { entriesController, onManualEntrySaved, onAddMoment, onDefaultModeChanged } = options;

  const menuButton = document.getElementById("timer-menu-btn");
  let menu = null;
  let manualEntryModal = null;
  let dataMenu = null;

  buildMenu();

  function buildMenu() {
    if (!menuButton) return;

    if (!manualEntryModal) {
      manualEntryModal = createTimeEntryModal({ onSave: onManualEntrySaved });
    }
    if (!dataMenu) {
      dataMenu = createDataManagementMenu();
    }

    menu?.dispose();

    const isCountdownDefault = getTimerDefaultMode() === "countdown";

    const items = [
      {
        label: "Add manual time entry",
        onSelect: () => {
          const lastEntry = entriesController?.getLastTimeEntry?.() || null;
          // Convert entry format to modal format
          const lastEntryForModal = lastEntry ? {
            endedAt: lastEntry.endedAt,
          } : null;
          manualEntryModal.openCreate(lastEntryForModal);
        },
      },
    ];

    if (typeof onAddMoment === "function") {
      items.push({
        label: "Add manual moment",
        onSelect: () => onAddMoment(""),
      });
    }

    items.push({
      label: isCountdownDefault
        ? "Default: Stopwatch"
        : "Default: Countdown",
      onSelect: () => {
        const nextMode = isCountdownDefault ? "stopwatch" : "countdown";
        setTimerDefaultMode(nextMode);
        if (typeof onDefaultModeChanged === "function") {
          onDefaultModeChanged(nextMode);
        }
        setTimeout(() => buildMenu(), 0);
      },
    });

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
