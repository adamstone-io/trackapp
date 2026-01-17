// data/storage.js
import { Moment } from "../domain/moment.js";
import { TimeEntry } from "../domain/time-entry.js";

const STORAGE_KEYS = {
  moments: "moments",
  timeEntries: "timeEntries",
};

// ========== MOMENTS ==========

export function saveMoments(moments) {
  const data = moments.map((m) => m.toJSON());
  localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data));
}

export function loadMoments() {
  const raw = localStorage.getItem(STORAGE_KEYS.moments);
  if (!raw) return [];
  
  try {
    const data = JSON.parse(raw);
    return data.map((item) => Moment.fromJSON(item));
  } catch (error) {
    console.error("Failed to load moments:", error);
    return [];
  }
}

// ========== TIME ENTRIES ==========

export function saveTimeEntries(entries) {
  const data = entries.map((e) => e.toJSON());
  localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data));
}

export function loadTimeEntries() {
  const raw = localStorage.getItem(STORAGE_KEYS.timeEntries);
  if (!raw) return [];
  
  try {
    const data = JSON.parse(raw);
    return data.map((item) => TimeEntry.fromJSON(item));
  } catch (error) {
    console.error("Failed to load time entries:", error);
    return [];
  }
}

// ========== EXPORT ==========

/**
 * Export all data to a JSON file.
 */
export function exportAllData() {
  const data = {
    moments: JSON.parse(localStorage.getItem(STORAGE_KEYS.moments) || "[]"),
    timeEntries: JSON.parse(localStorage.getItem(STORAGE_KEYS.timeEntries) || "[]"),
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  link.href = url;
  link.download = `timer-backup-${timestamp}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  console.log("Data exported");
}

/**
 * Import data from a JSON file.
 * @param {File} file - The file to import
 */
export async function importAllData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.moments) {
      localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data.moments));
    }
    if (data.timeEntries) {
      localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data.timeEntries));
    }
    
    console.log("Data imported successfully");
    return true;
  } catch (error) {
    console.error("Failed to import data:", error);
    alert("Import failed. Make sure the file is a valid backup.");
    return false;
  }
}

export function clearAllData() {
  if (confirm("Clear all data? This cannot be undone.")) {
    localStorage.removeItem(STORAGE_KEYS.moments);
    localStorage.removeItem(STORAGE_KEYS.timeEntries);
    console.log("All data cleared");
    return true;
  }
  return false;
}
