import { Moment } from "../domain/moment.js";
import { Habit } from "../domain/habit.js";
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

// ========== HABITS ==========

function normalizeHabitPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const daily_target =
    payload.daily_target ?? payload.dailyTarget ?? payload.targets?.daily;
  const weekly_target =
    payload.weekly_target ?? payload.weeklyTarget ?? payload.targets?.weekly;
  const monthly_target =
    payload.monthly_target ?? payload.monthlyTarget ?? payload.targets?.monthly;

  const daily_count =
    payload.daily_count ?? payload.dailyCount ?? payload.counts?.daily;
  const weekly_count =
    payload.weekly_count ?? payload.weeklyCount ?? payload.counts?.weekly;
  const monthly_count =
    payload.monthly_count ?? payload.monthlyCount ?? payload.counts?.monthly;

  const is_active = payload.is_active ?? payload.isActive;
  const created_at = payload.created_at ?? payload.createdAt;

  const normalized = { ...payload };
  delete normalized.targets;
  delete normalized.counts;
  delete normalized.isActive;
  delete normalized.dailyTarget;
  delete normalized.weeklyTarget;
  delete normalized.monthlyTarget;
  delete normalized.dailyCount;
  delete normalized.weeklyCount;
  delete normalized.monthlyCount;
  delete normalized.createdAt;

  if (daily_target !== undefined) normalized.daily_target = daily_target;
  if (weekly_target !== undefined) normalized.weekly_target = weekly_target;
  if (monthly_target !== undefined) normalized.monthly_target = monthly_target;

  if (daily_count !== undefined) normalized.daily_count = daily_count;
  if (weekly_count !== undefined) normalized.weekly_count = weekly_count;
  if (monthly_count !== undefined) normalized.monthly_count = monthly_count;

  if (is_active !== undefined) normalized.is_active = is_active;
  if (created_at !== undefined) normalized.created_at = created_at;

  return normalized;
}

function normalizeHabitFromApi(item) {
  if (!item || typeof item !== "object") return item;

  return {
    ...item,
    dailyTarget: item.dailyTarget ?? item.daily_target ?? item.targets?.daily,
    weeklyTarget:
      item.weeklyTarget ?? item.weekly_target ?? item.targets?.weekly,
    monthlyTarget:
      item.monthlyTarget ?? item.monthly_target ?? item.targets?.monthly,
    counts: {
      daily: item.counts?.daily ?? item.daily_count ?? 0,
      weekly: item.counts?.weekly ?? item.weekly_count ?? 0,
      monthly: item.counts?.monthly ?? item.monthly_count ?? 0,
    },
    isActive: item.isActive ?? item.is_active ?? true,
    createdAt: item.createdAt ?? item.created_at ?? null,
  };
}

export async function createHabit(payload) {
  return apiRequest("/habits/", {
    method: "POST",
    body: JSON.stringify(normalizeHabitPayload(payload)),
  });
}

export async function loadHabits() {
  const data = await apiRequest("/habits/");
  return (data.results ?? data).map((item) =>
    Habit.fromJSON(normalizeHabitFromApi(item)),
  );
}

export async function updateHabit(id, patch) {
  return apiRequest(`/habits/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizeHabitPayload(patch)),
  });
}

export async function deleteHabit(id) {
  return apiRequest(`/habits/${id}/`, { method: "DELETE" });
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
function normalizeReviewItemPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const review_timestamps =
    payload.review_timestamps ?? payload.reviewTimestamps;
  const first_studied_at = payload.first_studied_at ?? payload.firstStudiedAt;
  const created_at = payload.created_at ?? payload.createdAt;

  const normalized = { ...payload };
  delete normalized.reviewTimestamps;
  delete normalized.firstStudiedAt;
  delete normalized.createdAt;

  if (review_timestamps !== undefined)
    normalized.review_timestamps = review_timestamps;
  if (first_studied_at !== undefined) {
    let normalizedFirstStudiedAt = first_studied_at;
    if (
      typeof normalizedFirstStudiedAt === "number" &&
      Number.isFinite(normalizedFirstStudiedAt)
    ) {
      normalizedFirstStudiedAt = new Date(
        normalizedFirstStudiedAt,
      ).toISOString();
    } else if (normalizedFirstStudiedAt instanceof Date) {
      normalizedFirstStudiedAt = normalizedFirstStudiedAt.toISOString();
    }
    normalized.first_studied_at = normalizedFirstStudiedAt;
  }
  if (created_at !== undefined) normalized.created_at = created_at;

  return normalized;
}

function normalizeReviewItemFromApi(item) {
  if (!item || typeof item !== "object") return item;

  return {
    ...item,
    reviewTimestamps: item.reviewTimestamps ?? item.review_timestamps ?? [],
    firstStudiedAt: item.firstStudiedAt ?? item.first_studied_at ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
  };
}

export async function createReviewItem(payload) {
  return apiRequest("/review-items/", {
    method: "POST",
    body: JSON.stringify(normalizeReviewItemPayload(payload)),
  });
}

export async function loadReviewItems() {
  const data = await apiRequest("/review-items/");
  const items = data.results ?? data;
  return items.map((item) =>
    ReviewItem.fromJSON(normalizeReviewItemFromApi(item)),
  );
}

export async function updateReviewItem(id, patch) {
  return apiRequest(`/review-items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizeReviewItemPayload(patch)),
  });
}

export async function deleteReviewItem(id) {
  return apiRequest(`/review-items/${id}/`, { method: "DELETE" });
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

    const reviewItemPayload = {
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

    const createdReview = await createReviewItem(reviewItemPayload);
    await updatePrimeItem(primeItemId, { archived: true });
    return createdReview;
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
