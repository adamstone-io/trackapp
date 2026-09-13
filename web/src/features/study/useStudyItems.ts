import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStudyItem,
  listAllStudyItems,
  listStudyCategories,
  logInteraction,
  patchStudyItem,
  removeStudyImage,
  uploadStudyImage,
  type InteractionKind,
  type StudyImageSlot,
  type StudyItemCreate,
  type StudyItemPatch,
} from "../../api/studyItems";
import type { StudyItem } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";

export const STUDY_ITEMS_KEY = ["study-items"];
export const STUDY_CATEGORIES_KEY = [...STUDY_ITEMS_KEY, "categories"];

/** Shared key for per-item mutations (log/edit/archive) so a late response
 * can tell whether newer mutations for the same row are in flight. */
const STUDY_MUTATION_KEY = [...STUDY_ITEMS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

export function useStudyItemsQuery() {
  return useQuery({ queryKey: STUDY_ITEMS_KEY, queryFn: listAllStudyItems });
}

export function useStudyCategoriesQuery() {
  return useQuery({ queryKey: STUDY_CATEGORIES_KEY, queryFn: listStudyCategories });
}

/** Snapshot the cached list and apply an optimistic change; returns rollback state. */
async function snapshotAndApply(
  queryClient: QueryClient,
  apply: (current: StudyItem[]) => StudyItem[],
): Promise<StudyItem[] | undefined> {
  await queryClient.cancelQueries({ queryKey: STUDY_ITEMS_KEY });
  const previous = queryClient.getQueryData<StudyItem[]>(STUDY_ITEMS_KEY);
  queryClient.setQueryData<StudyItem[]>(STUDY_ITEMS_KEY, (current) => apply(current ?? []));
  return previous;
}

function replaceRow(queryClient: QueryClient, id: string, saved: StudyItem) {
  queryClient.setQueryData<StudyItem[]>(STUDY_ITEMS_KEY, (current) =>
    current?.map((item) => (item.id === id ? saved : item)),
  );
}

function rollback(queryClient: QueryClient, previous: StudyItem[] | undefined) {
  queryClient.setQueryData(STUDY_ITEMS_KEY, previous ?? []);
}

function patchInList(
  current: StudyItem[],
  id: string,
  patch: (item: StudyItem) => Partial<StudyItem>,
): StudyItem[] {
  return current.map((item) => (item.id === id ? { ...item, ...patch(item) } : item));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Sync the server's authoritative row — but only when this is the row's last
 * in-flight mutation; an earlier response landing late would clobber state
 * that newer optimistic updates already applied (same rule as useHabits). */
function syncFromServer(queryClient: QueryClient, saved: StudyItem | undefined, id: string) {
  if (!saved) return;
  const inFlight = queryClient.isMutating({
    mutationKey: STUDY_MUTATION_KEY,
    predicate: (mutation) => (mutation.state.variables as { id: string }).id === id,
  });
  if (inFlight <= 1) replaceRow(queryClient, saved.id, saved);
}

function invalidateCategories(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: STUDY_CATEGORIES_KEY });
}

/** One image slot's pending change: upload a file, or clear what's there. */
export interface StudyImageChange {
  file?: File;
  remove?: boolean;
}

export type StudyImageChanges = Partial<Record<StudyImageSlot, StudyImageChange>>;

const IMAGE_SLOTS: StudyImageSlot[] = ["image", "note_image"];

const IMAGE_LABELS: Record<StudyImageSlot, string> = {
  image: "prompt image",
  note_image: "note image",
};

const IMAGE_URL_FIELDS: Record<StudyImageSlot, "image_url" | "note_image_url"> = {
  image: "image_url",
  note_image: "note_image_url",
};

function hasChange(change: StudyImageChange | undefined): boolean {
  return Boolean(change?.file || change?.remove);
}

/** Apply the image legs once the row itself is saved. The legs are independent:
 * one failing leaves the saved row (and the other image) alone, and the caller
 * reports which slot failed rather than rolling anything back. */
async function applyImageChanges(
  id: string,
  changes: StudyImageChanges | undefined,
  saved: StudyItem,
): Promise<{ row: StudyItem; failed: StudyImageSlot[] }> {
  let row = saved;
  const failed: StudyImageSlot[] = [];
  for (const slot of IMAGE_SLOTS) {
    const change = changes?.[slot];
    if (!hasChange(change)) continue;
    try {
      row = change?.file
        ? await uploadStudyImage(id, slot, change.file)
        : await removeStudyImage(id, slot);
    } catch {
      failed.push(slot);
    }
  }
  return { row, failed };
}

/** "Saved the study item, but the note image failed to save." */
function imageFailureMessage(saved: string, failed: StudyImageSlot[]): string {
  const names = failed.map((slot) => IMAGE_LABELS[slot]).join(" and ");
  return `${saved}, but the ${names} failed to save.`;
}

/** The optimistic patch for image slots being cleared. */
function clearedImageUrls(changes: StudyImageChanges | undefined): Partial<StudyItem> {
  const cleared: Partial<StudyItem> = {};
  for (const slot of IMAGE_SLOTS) {
    if (changes?.[slot]?.remove && !changes[slot]?.file) cleared[IMAGE_URL_FIELDS[slot]] = null;
  }
  return cleared;
}

export interface StudyItemDraft {
  draft: StudyItemCreate;
  /** Uploaded after the create settles — the uploads need the server id. */
  images?: StudyImageChanges;
}

export function useCreateStudyItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ draft, images }: StudyItemDraft) => {
      // An image prompt rides the create itself; the row would not validate
      // without it. Everything else follows once the row has an id.
      const promptFile = images?.image?.file;
      const created = await createStudyItem(draft, promptFile);
      // The item is saved even if its images aren't: report the partial
      // failure but never roll back a row the server already has.
      const remaining = promptFile ? { ...images, image: undefined } : images;
      const { row, failed } = await applyImageChanges(created.id, remaining, created);
      if (failed.length > 0) showToast(imageFailureMessage("Saved the study item", failed));
      return row;
    },
    onMutate: async ({ draft }) => {
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const optimistic: StudyItem = {
        id: tempId,
        ...draft,
        image_url: null,
        note_image_url: null,
        prime_count: 0,
        study_count: 0,
        first_primed_at: null,
        last_primed_at: null,
        first_studied_at: null,
        last_studied_at: null,
        last_reviewed_at: null,
        is_archived: false,
      };
      const previous = await snapshotAndApply(queryClient, (current) => [...current, optimistic]);
      return { previous, tempId };
    },
    onSuccess: (saved, _variables, context) => {
      replaceRow(queryClient, context.tempId, saved);
      invalidateCategories(queryClient);
    },
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not save the study item."));
    },
  });
}

export interface StudyItemEdit {
  id: string;
  patch: StudyItemPatch;
  /** Per-slot image uploads/removals applied after the patch settles. */
  images?: StudyImageChanges;
}

/** Edit title/notes/category, flip is_archived, or change either image, optimistically. */
export function useEditStudyItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: STUDY_MUTATION_KEY,
    mutationFn: async ({ id, patch, images }: StudyItemEdit) => {
      // Clearing the prompt text is only legal once the image standing in for
      // it exists, so that upload has to go first.
      if (patch.prompt === "" && images?.image?.file) {
        const uploaded = await uploadStudyImage(id, "image", images.image.file);
        const rest = { ...images, image: undefined };
        // Same rule as the image legs: the upload the server took stands, and
        // a failure after it is reported rather than rolled back.
        const saved = await patchStudyItem(id, patch).catch(() => {
          showToast("Saved the image, but the rest of the changes failed to save.");
          return uploaded;
        });
        const { row, failed } = await applyImageChanges(id, rest, saved);
        if (failed.length > 0) showToast(imageFailureMessage("Saved the changes", failed));
        return row;
      }
      const saved = await patchStudyItem(id, patch);
      // The patch is saved even if an image change isn't: report the
      // partial failure but never roll back fields the server accepted.
      const { row, failed } = await applyImageChanges(id, images, saved);
      if (failed.length > 0) showToast(imageFailureMessage("Saved the changes", failed));
      return row;
    },
    onMutate: async ({ id, patch, images }) => ({
      previous: await snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, () => ({ ...patch, ...clearedImageUrls(images) })),
      ),
    }),
    onSettled: (saved, error, { id }) => {
      syncFromServer(queryClient, saved, id);
      if (!error) invalidateCategories(queryClient);
    },
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not update the study item."));
    },
  });
}

export function useLogInteraction() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: STUDY_MUTATION_KEY,
    mutationFn: ({ id, kind }: { id: string; kind: InteractionKind }) => logInteraction(id, kind),
    onMutate: async ({ id, kind }) => {
      const now = new Date().toISOString();
      return {
        previous: await snapshotAndApply(queryClient, (current) =>
          patchInList(current, id, (item) =>
            kind === "prime"
              ? {
                  prime_count: item.prime_count + 1,
                  first_primed_at: item.first_primed_at ?? now,
                  last_primed_at: now,
                }
              : {
                  study_count: item.study_count + 1,
                  first_studied_at: item.first_studied_at ?? now,
                  last_studied_at: now,
                },
          ),
        ),
      };
    },
    onSettled: (saved, _error, { id }) => syncFromServer(queryClient, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not log the interaction."));
    },
  });
}
