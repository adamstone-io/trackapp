// js/controllers/data-management-controller.js
import { exportAllData, importAllData, clearAllData } from "../data/storage.js";

/**
 * Deep module: owns all data-management behavior and DOM wiring.
 * Simple interface: menu items + dispose.
 */
export function createDataManagementMenu(options = {}) {
  const mount = options.mount ?? document.body;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  mount.appendChild(fileInput);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const success = await importAllData(file);
    if (success) {
      alert("Data imported! Refreshing...");
      location.reload();
    }
    e.target.value = "";
  }

  fileInput.addEventListener("change", handleFileChange);

  const items = [
    {
      label: "Export data",
      onSelect: () => {
        exportAllData();
        console.log("Data exported");
      },
    },
    {
      label: "Import data",
      onSelect: () => fileInput.click(),
    },
    {
      label: "Clear all data",
      onSelect: () => {
        if (clearAllData()) {
          location.reload();
        }
      },
    },
  ];

  function dispose() {
    fileInput.removeEventListener("change", handleFileChange);
    fileInput.remove();
  }

  return { items, dispose };
}
