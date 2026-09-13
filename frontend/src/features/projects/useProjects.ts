import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  deleteProject,
  listAllProjects,
  patchProject,
  type ProjectCreate,
  type ProjectPatch,
} from "../../api/projects";
import type { Project } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";

export const PROJECTS_KEY = ["projects"];

/** Shared key for per-project mutations (edit/archive/delete) so a late
 * response can tell whether newer mutations for the same row are in flight. */
const PROJECTS_MUTATION_KEY = [...PROJECTS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

export function useProjectsQuery() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: listAllProjects });
}

/** Snapshot the cached list and apply an optimistic change; returns rollback state. */
async function snapshotAndApply(
  queryClient: QueryClient,
  apply: (current: Project[]) => Project[],
): Promise<Project[] | undefined> {
  await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
  const previous = queryClient.getQueryData<Project[]>(PROJECTS_KEY);
  queryClient.setQueryData<Project[]>(PROJECTS_KEY, (current) => apply(current ?? []));
  return previous;
}

function replaceRow(queryClient: QueryClient, id: string, saved: Project) {
  queryClient.setQueryData<Project[]>(PROJECTS_KEY, (current) =>
    current?.map((item) => (item.id === id ? saved : item)),
  );
}

function rollback(queryClient: QueryClient, previous: Project[] | undefined) {
  queryClient.setQueryData(PROJECTS_KEY, previous ?? []);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function rowIdOf(variables: unknown): string {
  return typeof variables === "string" ? variables : (variables as { id: string }).id;
}

/** Sync the server's authoritative row — but only when this is the row's last
 * in-flight mutation; an earlier response landing late would clobber state
 * that newer optimistic updates already applied (same rule as useHabits). */
function syncFromServer(queryClient: QueryClient, saved: Project | undefined, id: string) {
  if (!saved) return;
  const inFlight = queryClient.isMutating({
    mutationKey: PROJECTS_MUTATION_KEY,
    predicate: (mutation) => rowIdOf(mutation.state.variables) === id,
  });
  if (inFlight <= 1) replaceRow(queryClient, saved.id, saved);
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: ProjectCreate) => createProject(draft),
    onMutate: async (draft) => {
      const tempId = `optimistic-${draft.name}`;
      const optimistic: Project = { id: tempId, ...draft, archived: false, total_seconds: 0 };
      const previous = await snapshotAndApply(queryClient, (current) => [...current, optimistic]);
      return { previous, tempId };
    },
    onSuccess: (saved, _draft, context) => replaceRow(queryClient, context.tempId, saved),
    onError: (error, _draft, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not save the project."));
    },
  });
}

/** Edit name/description/color or flip archived (archive/restore), optimistically. */
export function useEditProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: PROJECTS_MUTATION_KEY,
    mutationFn: ({ id, patch }: { id: string; patch: ProjectPatch }) => patchProject(id, patch),
    onMutate: async ({ id, patch }) => ({
      previous: await snapshotAndApply(queryClient, (current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    }),
    onSettled: (saved, _error, { id }) => syncFromServer(queryClient, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not update the project."));
    },
  });
}

/** Permanent delete. The backend unassigns the project's tasks (SET_NULL). */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: PROJECTS_MUTATION_KEY,
    mutationFn: (id: string) => deleteProject(id),
    onMutate: async (id) => ({
      previous: await snapshotAndApply(queryClient, (current) =>
        current.filter((item) => item.id !== id),
      ),
    }),
    onError: (error, _id, context) => {
      rollback(queryClient, context?.previous);
      showToast(errorMessage(error, "Could not delete the project."));
    },
  });
}
