import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import {
  createStudyItem,
  listStudyCategories,
  listStudyItems,
  logInteraction,
  patchStudyItem,
  removeStudyImage,
  uploadStudyImage,
  type InteractionKind,
  type StudyImageSlot,
  type StudyItemCreate,
  type StudyItemPatch,
  type StudyItemQuery,
} from "../../api/studyItems";
import type { PaginatedPage } from "../../api/client";
import type { StudyItem } from "../../api/types";
import { useMemo } from "react";
import { useToast } from "../../components/toast/ToastProvider";
import { playInteractionLoggedSound } from "../../lib/sounds";

export const STUDY_ITEMS_KEY = ["study-items"];
/** Every paged list hangs off this prefix, so one mutation can reach all of
 * them — active and archived, under whatever category filter — without also
 * matching the categories query that sits beside them. */
export const STUDY_LISTS_KEY = [...STUDY_ITEMS_KEY, "list"];
export const STUDY_CATEGORIES_KEY = [...STUDY_ITEMS_KEY, "categories"];

/** Shared key for per-item mutations (log/edit/archive) so a late response
 * can tell whether newer mutations for the same row are in flight. */
const STUDY_MUTATION_KEY = [...STUDY_ITEMS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

/** The filter a cached list was fetched under, read back off its query key. */
interface ListFilter {
  category: string;
  archived: boolean;
}

function studyListKey(query: StudyItemQuery): QueryKey {
  const filter: ListFilter = { category: query.category ?? "", archived: query.archived };
  return [...STUDY_LISTS_KEY, filter];
}

type StudyPages = InfiniteData<PaginatedPage<StudyItem>, number>;

/** A list the page can render: the rows loaded so far, and how to get more. */
export interface StudyList {
  items: StudyItem[];
  /** The whole collection's size, which is more than has been loaded. */
  count: number;
  /** Nothing to show yet — the first page is still in flight. */
  isPending: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/**
 * One page of rows at a time, the next arriving as the list is scrolled.
 *
 * The server holds the order and the filtering now. It has to: you cannot
 * sort or narrow a collection you have only seen the first twenty rows of.
 */
export function useStudyList(query: StudyItemQuery): StudyList {
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: studyListKey(query),
    queryFn: ({ pageParam }) => listStudyItems(query, pageParam),
    initialPageParam: 1,
    // DRF hands back an absolute `next` URL; its presence is the only part
    // that matters, since the page number is just how far we have walked.
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    // Changing the category filter is a new query key. Holding the previous
    // rows until the new ones land keeps the list from collapsing to a
    // loading line on every pass of the type-ahead.
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);

  return {
    items,
    count: data?.pages[0]?.count ?? 0,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}

export function useStudyCategoriesQuery() {
  return useQuery({ queryKey: STUDY_CATEGORIES_KEY, queryFn: listStudyCategories });
}

type ListSnapshot = [QueryKey, StudyPages | undefined][];

/** What every cached list holds right now, to roll back to on failure. */
async function snapshotLists(queryClient: QueryClient): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey: STUDY_LISTS_KEY });
  return queryClient.getQueriesData<StudyPages>({ queryKey: STUDY_LISTS_KEY });
}

/** Apply a change to every cached list, or to the ones the filter picks out. */
function applyToLists(
  queryClient: QueryClient,
  apply: (pages: StudyPages) => StudyPages,
  belongsIn?: (filter: ListFilter) => boolean,
) {
  queryClient.setQueriesData<StudyPages>(
    {
      queryKey: STUDY_LISTS_KEY,
      predicate: belongsIn
        ? ({ queryKey }) => belongsIn(queryKey[2] as ListFilter)
        : undefined,
    },
    (pages) => (pages ? apply(pages) : pages),
  );
}

async function snapshotAndApply(
  queryClient: QueryClient,
  apply: (pages: StudyPages) => StudyPages,
): Promise<ListSnapshot> {
  const previous = await snapshotLists(queryClient);
  applyToLists(queryClient, apply);
  return previous;
}

function rollback(queryClient: QueryClient, previous: ListSnapshot | undefined) {
  previous?.forEach(([key, pages]) => queryClient.setQueryData(key, pages));
}

/** Rewrite rows wherever they sit, leaving the paging untouched. */
function mapRows(change: (item: StudyItem) => StudyItem) {
  return (pages: StudyPages): StudyPages => ({
    ...pages,
    pages: pages.pages.map((page) => ({ ...page, results: page.results.map(change) })),
  });
}

function patchRow(id: string, patch: (item: StudyItem) => Partial<StudyItem>) {
  return mapRows((item) => (item.id === id ? { ...item, ...patch(item) } : item));
}

function withoutRow(pages: StudyPages, id: string): StudyPages {
  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      results: page.results.filter((item) => item.id !== id),
    })),
  };
}

/** DRF reports the whole collection's size on every page, and the archived
 * heading counts off it — so a row joining or leaving has to move it too, or
 * the count sits wrong until the next fetch. */
function withCount(pages: StudyPages, delta: number): StudyPages {
  return {
    ...pages,
    pages: pages.pages.map((page) => ({ ...page, count: Math.max(0, page.count + delta) })),
  };
}

/** Take a row out of this list altogether — it has moved to the other one. */
function dropRow(id: string) {
  return (pages: StudyPages): StudyPages => withCount(withoutRow(pages, id), -1);
}

/** The first page's head — where a never-touched item sorts, and where a
 * restored one is worth showing even if the server would file it deeper. */
function prependRow(item: StudyItem) {
  return (pages: StudyPages): StudyPages =>
    withCount(
      {
        ...pages,
        pages: pages.pages.map((page, index) =>
          index === 0 ? { ...page, results: [item, ...page.results] } : page,
        ),
      },
      1,
    );
}

/**
 * A logged prime or study is the item's most recent touch, so it sorts to the
 * very back of the queue (R31w) — the disappearing act the list used to
 * perform by re-sorting itself in the browser.
 *
 * Where the back is depends on how far the list has been walked. With the
 * last page loaded the row moves to the end of it; without, it drops out of
 * view, which is exactly where it now belongs. Either way it stays in the
 * collection, so the count does not move.
 */
function moveToBackOfQueue(id: string, patch: (item: StudyItem) => Partial<StudyItem>) {
  return (pages: StudyPages): StudyPages => {
    const row = pages.pages.flatMap((page) => page.results).find((item) => item.id === id);
    if (!row) return pages;
    const remaining = withoutRow(pages, id);
    const last = remaining.pages.length - 1;
    if (last < 0 || remaining.pages[last].next !== null) return remaining;
    return {
      ...remaining,
      pages: remaining.pages.map((page, index) =>
        index === last ? { ...page, results: [...page.results, { ...row, ...patch(row) }] } : page,
      ),
    };
  };
}

/** Mirrors the server's own filtering, so an optimistic row lands only in the
 * lists a refetch would actually return it in. */
function belongsIn(item: StudyItem) {
  return (filter: ListFilter) =>
    filter.archived === item.is_archived &&
    item.category.toLowerCase().startsWith(filter.category.toLowerCase());
}

function findRow(queryClient: QueryClient, id: string): StudyItem | undefined {
  for (const [, pages] of queryClient.getQueriesData<StudyPages>({ queryKey: STUDY_LISTS_KEY })) {
    for (const page of pages?.pages ?? []) {
      const found = page.results.find((item) => item.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Archiving and restoring move a row between two separately paged lists, so
 * the optimistic update is a removal and an insertion rather than a patch. */
function moveBetweenLists(queryClient: QueryClient, id: string, archived: boolean) {
  const row = findRow(queryClient, id);
  applyToLists(queryClient, dropRow(id));
  if (!row) return;
  const moved = { ...row, is_archived: archived };
  applyToLists(queryClient, prependRow(moved), belongsIn(moved));
}

function replaceRow(queryClient: QueryClient, id: string, saved: StudyItem) {
  applyToLists(queryClient, mapRows((item) => (item.id === id ? saved : item)));
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
      const previous = await snapshotLists(queryClient);
      applyToLists(queryClient, prependRow(optimistic), belongsIn(optimistic));
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
    onMutate: async ({ id, patch, images }) => {
      const previous = await snapshotLists(queryClient);
      // Archiving is a move between two separately paged lists, not a field
      // change: the row has to leave one and appear in the other.
      if (patch.is_archived === undefined) {
        applyToLists(queryClient, patchRow(id, () => ({ ...patch, ...clearedImageUrls(images) })));
      } else {
        moveBetweenLists(queryClient, id, patch.is_archived);
      }
      return { previous };
    },
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
        previous: await snapshotAndApply(
          queryClient,
          moveToBackOfQueue(id, (item) =>
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
    // Legacy parity: the tone confirms a recorded interaction, so it waits for
    // the request rather than riding the optimistic count.
    onSuccess: () => playInteractionLoggedSound(),
    onSettled: (saved, _error, { id }) => syncFromServer(queryClient, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not log the interaction."));
    },
  });
}
