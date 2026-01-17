// controllers/data-management-controller.js
import { DataManagementView } from "../views/data-management-view.js";
import { exportAllData, importAllData, clearAllData } from "../data/storage.js";

export function createDataManagementController() {
  const unbind = DataManagementView.bind({
    onExport: handleExport,
    onImport: handleImport,
    onClear: handleClear,
  });

  function handleExport() {
    exportAllData();
    console.log("Data exported");
  }

  async function handleImport(file) {
    const success = await importAllData(file);
    if (success) {
      alert("Data imported! Refreshing...");
      location.reload();
    }
  }

  function handleClear() {
    if (clearAllData()) {
      location.reload();
    }
  }

  return {
    dispose: unbind,
  };
}
