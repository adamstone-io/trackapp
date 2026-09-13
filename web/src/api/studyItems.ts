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

export function uploadStudyImage(id: string, file: File): Promise<StudyItem> {
  const form = new FormData();
  form.append("image", file);
  return apiFetch<StudyItem>(`/study-items/${id}/upload_image/`, { method: "POST", body: form });
}

export function removeStudyImage(id: string): Promise<StudyItem> {
  return apiFetch<StudyItem>(`/study-items/${id}/remove_image/`, { method: "DELETE" });
}
