import { API_BASE } from "./config.js";
import { http, json } from "./http.js";

const BASE = `${API_BASE}/habits`;

// ---------- LOAD ----------
export async function loadHabits({ page } = {}) {
  const { items } = await loadHabitsPage({ page });
  return items;
}

export async function loadHabitsPage({ page } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await http(`${BASE}/${query}`);

  const items = Array.isArray(data) ? data : data.results || [];
  return {
    items,
    next: data.next ?? null,
    previous: data.previous ?? null,
    count: data.count ?? items.length,
  };
}

// ---------- CREATE ----------
export async function createHabit(payload) {
  return json(`${BASE}/`, {
    method: "POST",
    body: normalizeHabitPayload(payload),
  });
}

// ---------- UPDATE ----------
export async function updateHabit(id, patch) {
  return json(`${BASE}/${id}/`, {
    method: "PATCH",
    body: normalizeHabitPayload(patch),
  });
}

// ---------- DELETE ----------
export async function deleteHabit(id) {
  return http(`${BASE}/${id}/`, { method: "DELETE" });
}

// ---------- LOG ----------
export async function logHabit(id, { amount = 1 } = {}) {
  // Get user's IANA timezone (e.g., 'Australia/Brisbane')
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return json(`${BASE}/${id}/log/`, {
    method: "POST",
    body: { amount },
    headers: {
      "X-User-Timezone": userTimezone,
    },
  });
}

// ---------- NORMALIZE ----------
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
