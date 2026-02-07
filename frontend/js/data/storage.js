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

const isLocalFrontend =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.hostname.endsWith(".local");

const apiOrigin = isLocalFrontend
  ? "http://127.0.0.1:8000" // your local Django server
  : window.APP_CONFIG?.API_ORIGIN || "";

if (!apiOrigin) throw new Error("Missing API origin");

export const API_BASE = `${apiOrigin.replace(/\/$/, "")}/api`;

export const AUTH_KEYS = {
  access: "authAccessToken",
  refresh: "authRefreshToken",
  username: "authUsername",
};

const LOGIN_PAGE = "login.html";

export function getAccessToken() {
  return localStorage.getItem(AUTH_KEYS.access);
}

function getRefreshToken() {
  return localStorage.getItem(AUTH_KEYS.refresh);
}

export function setAuthTokens({ access, refresh } = {}) {
  if (access) {
    localStorage.setItem(AUTH_KEYS.access, access);
    // Extract and store username from JWT for instant access
    try {
      const payload = JSON.parse(atob(access.split(".")[1]));
      const username = payload.username || payload.user || payload.sub;
      if (username) {
        localStorage.setItem(AUTH_KEYS.username, username);
      }
    } catch (e) {
      // Ignore decode errors
    }
  }
  if (refresh) {
    localStorage.setItem(AUTH_KEYS.refresh, refresh);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(AUTH_KEYS.access);
  localStorage.removeItem(AUTH_KEYS.refresh);
  localStorage.removeItem(AUTH_KEYS.username);
}

export function getUsername() {
  return localStorage.getItem(AUTH_KEYS.username);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

function isLoginPage() {
  return window.location.pathname.endsWith(`/${LOGIN_PAGE}`);
}

function redirectToLogin() {
  if (isLoginPage()) return;
  const next = encodeURIComponent(window.location.pathname.split("/").pop());
  window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearAuthTokens();
    return false;
  }

  const data = await response.json();
  if (!data?.access) return false;
  setAuthTokens({ access: data.access, refresh: data.refresh ?? refresh });
  return true;
}

function buildHeaders(options = {}, skipAuth = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

async function requestUrl(url, options = {}, config = {}) {
  const { skipAuth = false, retry = true } = config;
  const response = await fetch(url, {
    headers: buildHeaders(options, skipAuth),
    ...options,
  });

  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestUrl(url, options, { skipAuth, retry: false });
    }
    clearAuthTokens();
    redirectToLogin();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

async function apiRequest(path, options = {}, config = {}) {
  return requestUrl(`${API_BASE}${path}`, options, config);
}

async function apiRequestUrl(url, options = {}, config = {}) {
  return requestUrl(url, options, config);
}

async function fetchAllPages(path) {
  let url = `${API_BASE}${path}`;
  const results = [];

  while (url) {
    const data = await apiRequestUrl(url);
    if (data && Array.isArray(data.results)) {
      results.push(...data.results);
      url = data.next;
    } else if (Array.isArray(data)) {
      results.push(...data);
      url = null;
    } else {
      url = null;
    }
  }

  return results;
}

export async function registerUser({ username, password }) {
  return apiRequest(
    "/auth/register/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { skipAuth: true, retry: false }
  );
}

export async function loginUser({ username, password }) {
  const data = await apiRequest(
    "/auth/token/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { skipAuth: true, retry: false }
  );

  setAuthTokens({ access: data.access, refresh: data.refresh });
  return data;
}

export async function getCurrentUser() {
  return apiRequest("/auth/user/");
}

export async function ensureAuthenticated() {
  if (isLoginPage()) return true;
  if (getAccessToken()) return true;
  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    redirectToLogin();
    return false;
  }
  return true;
}

// ========== MOMENTS ==========

function normalizeMomentPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const timestamp = payload.timestamp ?? payload.timestampMs;
  const task = payload.task ?? payload.taskId;
  const task_title = payload.task_title ?? payload.taskTitle;
  const is_milestone = payload.is_milestone ?? payload.isMilestone;

  const normalized = { ...payload };
  delete normalized.timestampMs;
  delete normalized.taskId;
  delete normalized.taskTitle;
  delete normalized.isMilestone;

  if (timestamp !== undefined) {
    let normalizedTimestamp = timestamp;
    if (typeof normalizedTimestamp === "number") {
      normalizedTimestamp = new Date(normalizedTimestamp).toISOString();
    } else if (normalizedTimestamp instanceof Date) {
      normalizedTimestamp = normalizedTimestamp.toISOString();
    }
    normalized.timestamp = normalizedTimestamp;
  }

  if (task !== undefined) normalized.task = task;
  if (task_title !== undefined) normalized.task_title = task_title;
  if (is_milestone !== undefined) normalized.is_milestone = is_milestone;

  return normalized;
}

function normalizeMomentFromApi(item) {
  if (!item || typeof item !== "object") return item;

  const timestampSource = item.timestamp ?? item.timestampMs ?? null;
  const timestampMs = timestampSource
    ? new Date(timestampSource).getTime()
    : null;

  return {
    ...item,
    timestampMs: timestampMs ?? item.timestampMs ?? Date.now(),
    taskId: item.taskId ?? item.task ?? null,
    taskTitle: item.taskTitle ?? item.task_title ?? null,
    isMilestone: item.isMilestone ?? item.is_milestone ?? false,
    createdAt: item.createdAt ?? item.created_at ?? null,
  };
}

export async function createMoment(payload) {
  return apiRequest("/moments/", {
    method: "POST",
    body: JSON.stringify(normalizeMomentPayload(payload)),
  });
}

export async function loadMoments() {
  const items = await fetchAllPages("/moments/");
  return items.map((item) => Moment.fromJSON(normalizeMomentFromApi(item)));
}

export async function updateMoment(id, patch) {
  return apiRequest(`/moments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizeMomentPayload(patch)),
  });
}

export async function deleteMoment(id) {
  return apiRequest(`/moments/${id}/`, { method: "DELETE" });
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
  const items = await fetchAllPages("/habits/");
  return items.map((item) => Habit.fromJSON(normalizeHabitFromApi(item)));
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
  return fetchAllPages("/tasks/");
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
  return fetchAllPages("/projects/");
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
  return fetchAllPages("/time-entries/");
}

export async function loadTodayEntries() {
  try {
    const entries = await apiRequest("/today-entries/");
    return entries || [];
  } catch (error) {
    console.error("Failed to load today entries:", error);
    throw error;
  }
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
    totalCount: item.totalCount ?? item.total_count ?? null,
    todayCount: item.todayCount ?? item.today_count ?? null,
    thisWeekCount: item.thisWeekCount ?? item.week_count ?? null,
    thisMonthCount: item.thisMonthCount ?? item.month_count ?? null,
    firstPrimedAt: item.firstPrimedAt ?? item.first_primed_at ?? null,
    lastPrimedAt: item.lastPrimedAt ?? item.last_primed_at ?? null,
  };
}

export async function createPrimeItem(payload) {
  return apiRequest("/prime-items/", {
    method: "POST",
    body: JSON.stringify(normalizePrimeItemPayload(payload)),
  });
}

export async function loadPrimeItem(id) {
  const item = await apiRequest(`/prime-items/${id}/`);
  return PrimeItem.fromJSON(normalizePrimeItemFromApi(item));
}

export async function logPrimeItem(id) {
  const item = await apiRequest(`/prime-items/${id}/log_prime/`, {
    method: "POST",
  });
  return PrimeItem.fromJSON(normalizePrimeItemFromApi(item));
}

export async function loadPrimeItemsPage({ url = null, category = null } = {}) {
  try {
    let endpoint;

    if (url) {
      // Use the provided URL (for pagination)
      endpoint = url;
    } else {
      // Build initial URL with optional category filter
      endpoint = `${API_BASE}/prime-items/`;
      if (category) {
        endpoint += `?category=${encodeURIComponent(category)}`;
      }
    }

    const data = await apiRequestUrl(endpoint);

    // Map results to PrimeItem objects
    const items = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];

    return {
      items: items.map((item) =>
        PrimeItem.fromJSON(normalizePrimeItemFromApi(item))
      ),
      next: data.next || null,
    };
  } catch (error) {
    console.error("Error loading prime items:", error);
    return { items: [], next: null };
  }
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
        normalizedFirstStudiedAt
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
  const items = await fetchAllPages("/review-items/");
  return items.map((item) =>
    ReviewItem.fromJSON(normalizeReviewItemFromApi(item))
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
    const primeItem = await loadPrimeItem(primeItemId);
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

export async function exportAllData() {
  try {
    const [
      moments,
      tasks,
      projects,
      timeEntries,
      primeItems,
      reviewItems,
      habits,
    ] = await Promise.all([
      loadMoments(),
      loadTasks(),
      loadProjects(),
      loadTimeEntries(),
      loadPrimeItems({ includeTimestamps: true }),
      loadReviewItems(),
      loadHabits(),
    ]);

    const data = {
      moments: moments.map((m) => (m.toJSON ? m.toJSON() : m)),
      tasks: tasks.map((t) => (t.toJSON ? t.toJSON() : t)),
      projects: projects.map((p) => (p.toJSON ? p.toJSON() : p)),
      timeEntries: timeEntries.map((e) => (e.toJSON ? e.toJSON() : e)),
      primeItems: primeItems.map((p) => (p.toJSON ? p.toJSON() : p)),
      reviewItems: reviewItems.map((r) => (r.toJSON ? r.toJSON() : r)),
      habits: habits.map((h) => (h.toJSON ? h.toJSON() : h)),
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
    return true;
  } catch (error) {
    console.error("Failed to export data:", error);
    alert("Export failed. Check the console for details.");
    return false;
  }
}

export async function importAllData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const normalizeTaskImport = (task) => {
      if (!task || typeof task !== "object") return task;
      const normalized = { ...task };
      if (
        normalized.projectId !== undefined &&
        normalized.project === undefined
      ) {
        normalized.project = normalized.projectId;
      }
      if (
        normalized.plannedStart !== undefined &&
        normalized.planned_start === undefined
      ) {
        normalized.planned_start = normalized.plannedStart;
      }
      if (
        normalized.plannedDuration !== undefined &&
        normalized.planned_duration === undefined
      ) {
        normalized.planned_duration = normalized.plannedDuration;
      }
      if (
        normalized.createdAt !== undefined &&
        normalized.created_at === undefined
      ) {
        normalized.created_at = normalized.createdAt;
      }
      delete normalized.projectId;
      delete normalized.plannedStart;
      delete normalized.plannedDuration;
      delete normalized.createdAt;
      return normalized;
    };

    const normalizeProjectImport = (project) => {
      if (!project || typeof project !== "object") return project;
      const normalized = { ...project };
      if (
        normalized.createdAt !== undefined &&
        normalized.created_at === undefined
      ) {
        normalized.created_at = normalized.createdAt;
      }
      delete normalized.createdAt;
      return normalized;
    };

    const importCollection = async ({
      items,
      loadFn,
      createFn,
      updateFn,
      normalizeFn,
    }) => {
      if (!Array.isArray(items) || items.length === 0) return;
      const existing = await loadFn();
      const existingIds = new Set(existing.map((item) => item.id));

      for (const rawItem of items) {
        const payload = normalizeFn ? normalizeFn(rawItem) : rawItem;
        if (!payload) continue;

        if (payload.id && existingIds.has(payload.id)) {
          await updateFn(payload.id, payload);
        } else {
          await createFn(payload);
        }
      }
    };

    await importCollection({
      items: data.projects,
      loadFn: loadProjects,
      createFn: createProject,
      updateFn: updateProject,
      normalizeFn: normalizeProjectImport,
    });

    await importCollection({
      items: data.tasks,
      loadFn: loadTasks,
      createFn: createTask,
      updateFn: updateTask,
      normalizeFn: normalizeTaskImport,
    });

    await importCollection({
      items: data.timeEntries,
      loadFn: loadTimeEntries,
      createFn: createTimeEntry,
      updateFn: updateTimeEntry,
    });

    await importCollection({
      items: data.moments,
      loadFn: loadMoments,
      createFn: createMoment,
      updateFn: updateMoment,
    });

    await importCollection({
      items: data.primeItems,
      loadFn: loadPrimeItems,
      createFn: createPrimeItem,
      updateFn: updatePrimeItem,
    });

    await importCollection({
      items: data.reviewItems,
      loadFn: loadReviewItems,
      createFn: createReviewItem,
      updateFn: updateReviewItem,
    });

    await importCollection({
      items: data.habits,
      loadFn: loadHabits,
      createFn: createHabit,
      updateFn: updateHabit,
    });

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
