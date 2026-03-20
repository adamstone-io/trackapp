import { Moment } from "../domain/moment.js";
import { Habit } from "../domain/habit.js";
import { TimeEntry } from "../domain/time-entry.js";
import { Task } from "../domain/task.js";
import { Project } from "../domain/project.js";
import { StudyItem } from "../domain/study-item.js";
import { scheduleSessionExpiry } from "../api/authApi.js";
import { handleTrialExpiredBody } from "../utils/trial.js";

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

  scheduleSessionExpiry();
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
  const { headers: _, ...restOptions } = options;
  const response = await fetch(url, {
    ...restOptions,
    headers: buildHeaders(options, skipAuth),
  });

  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestUrl(url, options, { skipAuth, retry: false });
    }
    clearAuthTokens();
    redirectToLogin();
    throw new Error("Authentication required");
  }

  if (response.status === 403) {
    const text = await response.text();
    if (handleTrialExpiredBody(text)) {
      throw new Error("trial_expired");
    }
    throw new Error(`API 403: ${text}`);
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
    { skipAuth: true, retry: false },
  );
}

export async function loginUser({ username, password }) {
  const data = await apiRequest(
    "/auth/token/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { skipAuth: true, retry: false },
  );

  setAuthTokens({ access: data.access, refresh: data.refresh });
  return data;
}

export async function getCurrentUser() {
  return apiRequest("/auth/user/");
}

export async function ensureAuthenticated() {
  if (isLoginPage()) return true;
  if (getAccessToken()) {
    scheduleSessionExpiry();
    return true;
  }
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

// ========== ACTIVE TIMER ==========

export async function getActiveTimer() {
  return apiRequest("/active-timer/", { method: "GET" });
}

export async function createActiveTimer(payload) {
  return apiRequest("/active-timer/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateActiveTimer(patch) {
  return apiRequest("/active-timer/", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteActiveTimer() {
  return apiRequest("/active-timer/", { method: "DELETE" });
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

export async function loadTodayEntries(dateStr = null) {
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = dateStr
      ? `/today-entries/?date=${encodeURIComponent(dateStr)}`
      : "/today-entries/";
    const entries = await apiRequest(url, {
      headers: { "X-User-Timezone": userTimezone },
    });
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


// ========== STUDY ITEMS ==========

function normalizeStudyItemPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const study_timestamps = payload.study_timestamps ?? payload.studyTimestamps;
  const first_studied_at = payload.first_studied_at ?? payload.firstStudiedAt;
  const last_studied_at = payload.last_studied_at ?? payload.lastStudiedAt;
  const created_at = payload.created_at ?? payload.createdAt;
  const source_prime_item_id =
    payload.source_prime_item_id ?? payload.sourcePrimeItemId;

  const normalized = { ...payload };
  delete normalized.studyTimestamps;
  delete normalized.firstStudiedAt;
  delete normalized.lastStudiedAt;
  delete normalized.createdAt;
  delete normalized.sourcePrimeItemId;

  if (study_timestamps !== undefined)
    normalized.study_timestamps = study_timestamps;
  if (first_studied_at !== undefined) {
    let val = first_studied_at;
    if (typeof val === "number" && Number.isFinite(val)) {
      val = new Date(val).toISOString();
    } else if (val instanceof Date) {
      val = val.toISOString();
    }
    normalized.first_studied_at = val;
  }
  if (last_studied_at !== undefined) {
    let val = last_studied_at;
    if (typeof val === "number" && Number.isFinite(val)) {
      val = new Date(val).toISOString();
    } else if (val instanceof Date) {
      val = val.toISOString();
    }
    normalized.last_studied_at = val;
  }
  if (created_at !== undefined) normalized.created_at = created_at;
  if (source_prime_item_id !== undefined)
    normalized.source_prime_item_id = source_prime_item_id;

  return normalized;
}

function normalizeStudyItemFromApi(item) {
  if (!item || typeof item !== "object") return item;

  return {
    ...item,
    studyTimestamps: item.studyTimestamps ?? item.study_timestamps ?? [],
    firstStudiedAt: item.firstStudiedAt ?? item.first_studied_at ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
    sourcePrimeItemId:
      item.sourcePrimeItemId ?? item.source_prime_item_id ?? null,
  };
}

export async function createStudyItem(payload) {
  return apiRequest("/study-items/", {
    method: "POST",
    body: JSON.stringify(normalizeStudyItemPayload(payload)),
  });
}

export async function loadStudyItems() {
  const items = await fetchAllPages("/study-items/");
  return items.map((item) =>
    StudyItem.fromJSON(normalizeStudyItemFromApi(item)),
  );
}

export async function loadStudyItem(id) {
  try {
    const data = await apiRequest(`/study-items/${id}/`);
    return StudyItem.fromJSON(normalizeStudyItemFromApi(data));
  } catch (error) {
    console.error("Failed to load study item:", error);
    return null;
  }
}

export async function updateStudyItem(id, patch) {
  return apiRequest(`/study-items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(normalizeStudyItemPayload(patch)),
  });
}

export async function deleteStudyItem(id) {
  return apiRequest(`/study-items/${id}/`, { method: "DELETE" });
}

export async function logStudyItem(id) {
  return apiRequest(`/study-items/${id}/log_study/`, { method: "POST" });
}


/**
 * Reactivate a study item from a review item.
 * Restores the archived study item linked to the review.
 * @param {string} studyItemId - ID of the study item to reactivate
 * @returns {boolean} - Whether reactivation was successful
 */
export async function reactivateStudyItem(studyItemId) {
  try {
    await updateStudyItem(studyItemId, { archived: false });
    return true;
  } catch (error) {
    console.error("Failed to reactivate study item:", error);
    return false;
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
      habits,
    ] = await Promise.all([
      loadMoments(),
      loadTasks(),
      loadProjects(),
      loadTimeEntries(),
      loadHabits(),
    ]);

    const data = {
      moments: moments.map((m) => (m.toJSON ? m.toJSON() : m)),
      tasks: tasks.map((t) => (t.toJSON ? t.toJSON() : t)),
      projects: projects.map((p) => (p.toJSON ? p.toJSON() : p)),
      timeEntries: timeEntries.map((e) => (e.toJSON ? e.toJSON() : e)),
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
