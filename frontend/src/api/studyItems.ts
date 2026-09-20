import { apiFetch, type PaginatedPage } from "./client";
import type { StudyItem } from "./types";

/** Which of the page's two lists to read, and narrowed to what category. */
export interface StudyItemQuery {
  /** Prefix match, applied by the server — the filter box's typed text. */
  category?: string;
  archived: boolean;
}

/**
 * One page of study items, in the server's least-recently-touched order.
 *
 * A page at a time, not the whole collection: a mature account holds
 * thousands of items, and walking every page before the first row rendered
 * left the page blank for minutes.
 */
export function listStudyItems(
  query: StudyItemQuery,
  page: number,
): Promise<PaginatedPage<StudyItem>> {
  const params = new URLSearchParams({ page: String(page), archived: String(query.archived) });
  if (query.category) params.set("category", query.category);
  return apiFetch<PaginatedPage<StudyItem>>(`/study-items/?${params}`);
}

export interface StudyItemCreate {
  prompt: string;
  notes: string;
  category: string;
}

/**
 * The backend requires an item to hold a prompt or an image at every point, so
 * an image-prompt item has to arrive with its image rather than uploading it
 * in a second step — hence the multipart path.
 */
export function createStudyItem(payload: StudyItemCreate, image?: File): Promise<StudyItem> {
  if (!image) {
    return apiFetch<StudyItem>("/study-items/", { method: "POST", body: payload });
  }
  const form = new FormData();
  for (const [field, value] of Object.entries(payload)) form.append(field, value);
  form.append("image", image);
  return apiFetch<StudyItem>("/study-items/", { method: "POST", body: form });
}

export type StudyItemPatch = Partial<
  Pick<StudyItem, "prompt" | "notes" | "category" | "is_archived">
>;

export function patchStudyItem(id: string, patch: StudyItemPatch): Promise<StudyItem> {
  return apiFetch<StudyItem>(`/study-items/${id}/`, { method: "PATCH", body: patch });
}

export type InteractionKind = "prime" | "study";

export function logInteraction(id: string, interaction: InteractionKind): Promise<StudyItem> {
  return apiFetch<StudyItem>(`/study-items/${id}/log_interaction/`, {
    method: "POST",
    body: { interaction },
  });
}

export interface StudyCategory {
  category: string;
  count: number;
}

export function listStudyCategories(): Promise<StudyCategory[]> {
  return apiFetch<StudyCategory[]>("/study-items/categories/");
}

/** A study item carries two images: one for the prompt, one for the answer note. */
export type StudyImageSlot = "image" | "note_image";

const IMAGE_ACTIONS: Record<StudyImageSlot, { upload: string; remove: string }> = {
  image: { upload: "upload_image", remove: "remove_image" },
  note_image: { upload: "upload_note_image", remove: "remove_note_image" },
};

export function uploadStudyImage(id: string, slot: StudyImageSlot, file: File): Promise<StudyItem> {
  const form = new FormData();
  // The form field name matches the model field the endpoint writes to.
  form.append(slot, file);
  return apiFetch<StudyItem>(`/study-items/${id}/${IMAGE_ACTIONS[slot].upload}/`, {
    method: "POST",
    body: form,
  });
}

export function removeStudyImage(id: string, slot: StudyImageSlot): Promise<StudyItem> {
  return apiFetch<StudyItem>(`/study-items/${id}/${IMAGE_ACTIONS[slot].remove}/`, {
    method: "DELETE",
  });
}
