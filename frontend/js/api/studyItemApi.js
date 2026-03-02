import { API_BASE } from "./config.js";
import { http, json } from "./http.js";

const BASE = `${API_BASE}/study-items`;

// ---------- LOAD ----------

export async function loadStudyItems(options = {}) {
  const { items } = await loadStudyItemsPage(options);
  return items;
}

export async function loadStudyItemsPage({
  mode,
  category,
  search,
  page,
} = {}) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (category) params.set("category", category);
  if (search) params.set("search", search);
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

export async function createStudyItem(payload, imageFile = null, noteImageFile = null) {
  if (imageFile || noteImageFile) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      formData.append(key, value);
    });
    if (imageFile) formData.append("image", imageFile);
    if (noteImageFile) formData.append("note_image", noteImageFile);

    return http(`${BASE}/`, {
      method: "POST",
      body: formData,
    });
  }

  return json(`${BASE}/`, {
    method: "POST",
    body: payload,
  });
}

// ---------- UPDATE ----------

export async function updateStudyItem(id, patch) {
  return json(`${BASE}/${id}/`, {
    method: "PATCH",
    body: patch,
  });
}

// ---------- DELETE ----------

export async function deleteStudyItem(id) {
  return http(`${BASE}/${id}/`, {
    method: "DELETE",
  });
}

// ---------- LOG ----------

export async function logInteraction(id) {
  return http(`${BASE}/${id}/log_interaction/`, {
    method: "POST",
  });
}

// ---------- TRANSITIONS ----------

export async function transitionToPriming(id) {
  return http(`${BASE}/${id}/transition_to_priming/`, {
    method: "POST",
  });
}

export async function transitionToStudying(id) {
  return http(`${BASE}/${id}/transition_to_studying/`, {
    method: "POST",
  });
}

export async function transitionToReviewing(id) {
  return http(`${BASE}/${id}/transition_to_reviewing/`, {
    method: "POST",
  });
}

// ---------- NOTE IMAGE ----------

export async function uploadNoteImage(id, imageFile) {
  const formData = new FormData();
  formData.append("note_image", imageFile);
  return http(`${BASE}/${id}/upload_note_image/`, {
    method: "POST",
    body: formData,
  });
}

export async function removeNoteImage(id) {
  return http(`${BASE}/${id}/remove_note_image/`, {
    method: "DELETE",
  });
}

// ---------- CATEGORIES ----------

export async function loadCategories({ mode } = {}) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);

  const query = params.toString() ? `?${params.toString()}` : "";

  return http(`${BASE}/categories/${query}`);
}
