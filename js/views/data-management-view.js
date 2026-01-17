// views/data-management-view.js
import { byId } from "../ui/ui-core.js";

export const DataManagementView = {
  exportBtn: () => byId("export-data-btn"),
  importBtn: () => byId("import-data-btn"),
  clearBtn: () => byId("clear-data-btn"),
  fileInput: () => byId("import-file-input"),

  /**
   * Bind event handlers.
   */
  bind({ onExport, onImport, onClear }) {
    const exportBtn = this.exportBtn();
    const importBtn = this.importBtn();
    const clearBtn = this.clearBtn();
    const fileInput = this.fileInput();

    const handleImportClick = () => fileInput.click();
    const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await onImport(file);
        e.target.value = ""; // Reset
      }
    };

    exportBtn.addEventListener("click", onExport);
    importBtn.addEventListener("click", handleImportClick);
    clearBtn.addEventListener("click", onClear);
    fileInput.addEventListener("change", handleFileChange);

    // Return cleanup function
    return () => {
      exportBtn.removeEventListener("click", onExport);
      importBtn.removeEventListener("click", handleImportClick);
      clearBtn.removeEventListener("click", onClear);
      fileInput.removeEventListener("change", handleFileChange);
    };
  },
};
