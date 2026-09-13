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

export interface StudyItemDraft {
  draft: StudyItemCreate;
  /** Uploaded after the create settles — the upload needs the server id. */
  imageFile?: File;
}

export function useCreateStudyItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ draft, imageFile }: StudyItemDraft) => {
      const created = await createStudyItem(draft);
      if (!imageFile) return created;
      // The item is saved even if its image isn't: report the partial
      // failure but never roll back a row the server already has.
      try {
        return await uploadStudyImage(created.id, imageFile);
      } catch {
        showToast("Saved the study item, but the image upload failed.");
        return created;
      }
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
  /** Replaces the item's image after the patch settles. */
  imageFile?: File;
  /** Removes the item's image (ignored when imageFile is given). */
  removeImage?: boolean;
}

/** Edit title/notes/category, flip is_archived, or change the image, optimistically. */
export function useEditStudyItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: STUDY_MUTATION_KEY,
    mutationFn: async ({ id, patch, imageFile, removeImage }: StudyItemEdit) => {
      const saved = await patchStudyItem(id, patch);
      if (!imageFile && !removeImage) return saved;
      // The patch is saved even if the image change isn't: report the
      // partial failure but never roll back fields the server accepted.
      try {
        return imageFile ? await uploadStudyImage(id, imageFile) : await removeStudyImage(id);
      } catch {
        showToast("Saved the changes, but updating the image failed.");
        return saved;
      }
    },
    onMutate: async ({ id, patch, removeImage }) => ({
      previous: await snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, () => (removeImage ? { ...patch, image_url: null } : patch)),
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
