import { apiFetch, fetchAllPages } from "./client";
import type { StudyItem } from "./types";

export function listAllStudyItems(): Promise<StudyItem[]> {
  return fetchAllPages<StudyItem>("/study-items/");
}

export interface StudyItemCreate {
  prompt: string;
  notes: string;
  category: string;
}

export function createStudyItem(payload: StudyItemCreate): Promise<StudyItem> {
  return apiFetch<StudyItem>("/study-items/", { method: "POST", body: payload });
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
