import { Moment } from "../domain/moment.js";
import { TimeEntry } from "../domain/time-entry.js";
import { Task } from "../domain/task.js";
import { Project } from "../domain/project.js";
import { PrimeItem } from "../domain/prime-item.js";
import { ReviewItem } from "../domain/review-item.js";

const STORAGE_KEYS = {
  moments: "moments",
  timeEntries: "timeEntries",
  tasks: "tasks",
  projects: "projects",
  activeTimer: "activeTimer",
  primeItems: "primeItems",
  reviewItems: "reviewItems",
};

const API_BASE = "http://127.0.0.1:8000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

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

export function updateMoment(id, patch) {
  const raw = localStorage.getItem(STORAGE_KEYS.moments);
  const data = raw ? JSON.parse(raw) : [];

  const index = data.findIndex((m) => m.id === id);
  if (index === -1) return false;

  const current = data[index];
  data[index] = {
    ...current,
    ...patch,
    id: current.id,
  };

  localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data));
  return true;
}

export function deleteMoment(id) {
  const raw = localStorage.getItem(STORAGE_KEYS.moments);
  const data = raw ? JSON.parse(raw) : [];

  const next = data.filter((m) => m.id !== id);
  const changed = next.length !== data.length;

  if (changed) {
    localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(next));
  }

  return changed;
}

// ========== TASKS ==========

export async function createTask(payload) {
  return apiRequest("/tasks/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadTasks() {
  const data = await apiRequest("/tasks/");
  return data.results ?? data;
}

export async function updateTask(id, patch) {
  return apiRequest(`/tasks/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteTask(id) {
  return apiRequest(`/tasks/${id}/`, { method: "DELETE" });
}

// ========== PROJECTS ==========

export async function createProject(payload) {
  return apiRequest("/projects/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadProjects() {
  const data = await apiRequest("/projects/");
  return data.results ?? data;
}

export async function updateProject(id, patch) {
  return apiRequest(`/projects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(id) {
  return apiRequest(`/projects/${id}/`, { method: "DELETE" });
}

// ========== TIME ENTRIES ==========

function normalizeTimeEntryPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const task_title = payload.task_title ?? payload.taskTitle;
  const started_at = payload.started_at ?? payload.startedAt;
  const ended_at = payload.ended_at ?? payload.endedAt;
  const duration_seconds = payload.duration_seconds ?? payload.durationSeconds;

  const normalized = { ...payload };
  delete normalized.taskTitle;
  delete normalized.startedAt;
  delete normalized.endedAt;
  delete normalized.durationSeconds;

  if (task_title !== undefined) normalized.task_title = task_title;
  if (started_at !== undefined) normalized.started_at = started_at;
  if (ended_at !== undefined) normalized.ended_at = ended_at;
  if (duration_seconds !== undefined)
    normalized.duration_seconds = duration_seconds;

  return normalized;
}

export async function createTimeEntry(payload) {
  return apiRequest("/time-entries/", {
    method: "POST",
    body: JSON.stringify(normalizeTimeEntryPayload(payload)),
  });
}

export async function loadTimeEntries() {
  const data = await apiRequest("/time-entries/");
  return data.results ?? data;
}

export async function updateTimeEntry(id, patch) {
  return apiRequest(`/time-entries/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizeTimeEntryPayload(patch)),
  });
}

export async function deleteTimeEntry(id) {
  return apiRequest(`/time-entries/${id}/`, { method: "DELETE" });
}

// ========== ACTIVE TIMER ==========

export function saveActiveTimer(payload) {
  localStorage.setItem(STORAGE_KEYS.activeTimer, JSON.stringify(payload));
}

export function loadActiveTimer() {
  const raw = localStorage.getItem(STORAGE_KEYS.activeTimer);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load active timer:", error);
    return null;
  }
}

export function clearActiveTimer() {
  localStorage.removeItem(STORAGE_KEYS.activeTimer);
}

// ========== PRIME ITEMS ==========

function normalizePrimeItemPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const prime_timestamps = payload.prime_timestamps ?? payload.primeTimestamps;
  const created_at = payload.created_at ?? payload.createdAt;

  const normalized = { ...payload };
  delete normalized.primeTimestamps;
  delete normalized.createdAt;

  if (prime_timestamps !== undefined)
    normalized.prime_timestamps = prime_timestamps;
  if (created_at !== undefined) normalized.created_at = created_at;

  return normalized;
}

function normalizePrimeItemFromApi(item) {
  if (!item || typeof item !== "object") return item;

  return {
    ...item,
    primeTimestamps: item.primeTimestamps ?? item.prime_timestamps ?? [],
    createdAt: item.createdAt ?? item.created_at ?? null,
  };
}

export async function createPrimeItem(payload) {
  return apiRequest("/prime-items/", {
    method: "POST",
    body: JSON.stringify(normalizePrimeItemPayload(payload)),
  });
}

export async function loadPrimeItems() {
  const data = await apiRequest("/prime-items/");
  const items = data.results ?? data;
  return items.map((item) =>
    PrimeItem.fromJSON(normalizePrimeItemFromApi(item)),
  );
}

export async function updatePrimeItem(id, patch) {
  return apiRequest(`/prime-items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizePrimeItemPayload(patch)),
  });
}

export async function deletePrimeItem(id) {
  return apiRequest(`/prime-items/${id}/`, { method: "DELETE" });
}

// ========== REVIEW ITEMS ==========

export function saveReviewItems(reviewItems) {
  const data = reviewItems.map((r) => (r.toJSON ? r.toJSON() : r));
  localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(data));
}

export function loadReviewItems() {
  const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    return data.map((item) => ReviewItem.fromJSON(item));
  } catch (error) {
    console.error("Failed to load review items:", error);
    return [];
  }
}

export function updateReviewItem(id, patch) {
  const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
  const data = raw ? JSON.parse(raw) : [];

  const index = data.findIndex((r) => r.id === id);
  if (index === -1) return false;

  const current = data[index];
  data[index] = {
    ...current,
    ...patch,
    id: current.id,
  };

  localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(data));
  return true;
}

export function deleteReviewItem(id) {
  const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
  const data = raw ? JSON.parse(raw) : [];

  const next = data.filter((r) => r.id !== id);
  const changed = next.length !== data.length;

  if (changed) {
    localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(next));
  }

  return changed;
}

// ========== CONVERSION UTILITIES ==========

/**
 * Convert a prime item to a review item.
 * Creates a new review item and archives the original prime item.
 * @param {string} primeItemId - ID of the prime item to convert
 * @returns {Object|null} - The created review item or null if failed
 */
export async function convertPrimeToReview(primeItemId) {
  try {
    const primeItems = await loadPrimeItems();
    const primeItem = primeItems.find((p) => p.id === primeItemId);
    if (!primeItem) return null;

    const reviewItem = {
      id: crypto.randomUUID(),
      title: primeItem.title,
      description: primeItem.description || "",
      category: primeItem.category || "",
      reviewTimestamps: [...(primeItem.primeTimestamps || [])],
      firstStudiedAt:
        primeItem.primeTimestamps && primeItem.primeTimestamps.length > 0
          ? Math.min(...primeItem.primeTimestamps)
          : null,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    const reviewRaw = localStorage.getItem(STORAGE_KEYS.reviewItems);
    const reviewData = reviewRaw ? JSON.parse(reviewRaw) : [];
    reviewData.push(reviewItem);
    localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(reviewData));

    await updatePrimeItem(primeItemId, { archived: true });
    return reviewItem;
  } catch (error) {
    console.error("Failed to convert prime item to review:", error);
    return null;
  }
}

// ========== EXPORT ==========

export function exportAllData() {
  const data = {
    moments: JSON.parse(localStorage.getItem(STORAGE_KEYS.moments) || "[]"),
    tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || "[]"),
    projects: JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || "[]"),
    timeEntries: JSON.parse(
      localStorage.getItem(STORAGE_KEYS.timeEntries) || "[]",
    ),
    primeItems: JSON.parse(
      localStorage.getItem(STORAGE_KEYS.primeItems) || "[]",
    ),
    reviewItems: JSON.parse(
      localStorage.getItem(STORAGE_KEYS.reviewItems) || "[]",
    ),
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const timestamp = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `timer-backup-${timestamp}.json`;
  link.click();

  URL.revokeObjectURL(url);
  console.log("Data exported");
}

export async function importAllData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.moments) {
      localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data.moments));
    }
    if (data.tasks) {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data.tasks));
    }
    if (data.projects) {
      localStorage.setItem(
        STORAGE_KEYS.projects,
        JSON.stringify(data.projects),
      );
    }
    if (data.timeEntries) {
      localStorage.setItem(
        STORAGE_KEYS.timeEntries,
        JSON.stringify(data.timeEntries),
      );
    }
    if (data.primeItems) {
      localStorage.setItem(
        STORAGE_KEYS.primeItems,
        JSON.stringify(data.primeItems),
      );
    }
    if (data.reviewItems) {
      localStorage.setItem(
        STORAGE_KEYS.reviewItems,
        JSON.stringify(data.reviewItems),
      );
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
    localStorage.removeItem(STORAGE_KEYS.tasks);
    localStorage.removeItem(STORAGE_KEYS.projects);
    localStorage.removeItem(STORAGE_KEYS.timeEntries);
    localStorage.removeItem(STORAGE_KEYS.primeItems);
    localStorage.removeItem(STORAGE_KEYS.reviewItems);
    console.log("All data cleared");
    return true;
  }
  return false;
}
