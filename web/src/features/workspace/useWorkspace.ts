import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  deleteProject,
  listAllProjects,
  patchProject,
  type ProjectCreate,
  type ProjectPatch,
} from "../../api/projects";
import {
  createTask,
  deleteTask,
  listAllTasks,
  patchTask,
  type TaskCreate,
  type TaskPatch,
} from "../../api/tasks";
import type { Project, Task } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";

export const PROJECTS_KEY = ["projects"];
export const TASKS_KEY = ["tasks"];

/** Shared keys for per-row mutations (edit/archive/delete) so a late response
 * can tell whether newer mutations for the same row are still in flight. */
const PROJECTS_MUTATION_KEY = [...PROJECTS_KEY, "mutate"];
const TASKS_MUTATION_KEY = [...TASKS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

export function useProjectsQuery() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: listAllProjects });
}

export function useTasksQuery() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: listAllTasks });
}

/** Snapshot a cached list and apply an optimistic change; returns rollback state. */
async function snapshotAndApply<T>(
  queryClient: QueryClient,
  key: string[],
  apply: (current: T[]) => T[],
): Promise<T[] | undefined> {
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<T[]>(key);
  queryClient.setQueryData<T[]>(key, (current) => apply(current ?? []));
  return previous;
}

function replaceRow<T extends { id: string }>(
  queryClient: QueryClient,
  key: string[],
  id: string,
  saved: T,
) {
  queryClient.setQueryData<T[]>(key, (current) =>
    current?.map((item) => (item.id === id ? saved : item)),
  );
}

function rollback<T>(queryClient: QueryClient, key: string[], previous: T[] | undefined) {
  queryClient.setQueryData(key, previous ?? []);
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
function syncFromServer<T extends { id: string }>(
  queryClient: QueryClient,
  key: string[],
  mutationKey: string[],
  saved: T | undefined,
  id: string,
) {
  if (!saved) return;
  const inFlight = queryClient.isMutating({
    mutationKey,
    predicate: (mutation) => rowIdOf(mutation.state.variables) === id,
  });
  if (inFlight <= 1) replaceRow(queryClient, key, id, saved);
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: ProjectCreate) => createProject(draft),
    onMutate: async (draft) => {
      const tempId = `optimistic-${draft.name}`;
      const optimistic: Project = { id: tempId, ...draft, archived: false, total_seconds: 0 };
      const previous = await snapshotAndApply<Project>(queryClient, PROJECTS_KEY, (current) => [
        ...current,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onSuccess: (saved, _draft, context) =>
      replaceRow(queryClient, PROJECTS_KEY, context.tempId, saved),
    onError: (error, _draft, context) => {
      rollback(queryClient, PROJECTS_KEY, context?.previous);
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
      previous: await snapshotAndApply<Project>(queryClient, PROJECTS_KEY, (current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    }),
    onSettled: (saved, _error, { id }) =>
      syncFromServer(queryClient, PROJECTS_KEY, PROJECTS_MUTATION_KEY, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, PROJECTS_KEY, context?.previous);
      showToast(errorMessage(error, "Could not update the project."));
    },
  });
}

/** Permanent delete. Mirrors the backend's SET_NULL by unassigning the
 * project's tasks in the tasks cache; rolls both lists back on failure. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: PROJECTS_MUTATION_KEY,
    mutationFn: (id: string) => deleteProject(id),
    onMutate: async (id) => ({
      previousProjects: await snapshotAndApply<Project>(queryClient, PROJECTS_KEY, (current) =>
        current.filter((item) => item.id !== id),
      ),
      previousTasks: await snapshotAndApply<Task>(queryClient, TASKS_KEY, (current) =>
        current.map((item) => (item.project === id ? { ...item, project: null } : item)),
      ),
    }),
    onError: (error, _id, context) => {
      rollback(queryClient, PROJECTS_KEY, context?.previousProjects);
      rollback(queryClient, TASKS_KEY, context?.previousTasks);
      showToast(errorMessage(error, "Could not delete the project."));
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: TaskCreate) => createTask(draft),
    onMutate: async (draft) => {
      const tempId = `optimistic-${draft.title}`;
      const optimistic: Task = {
        id: tempId,
        title: draft.title,
        category: draft.category ?? "other",
        project: draft.project ?? null,
        notes: "",
        archived: false,
        total_seconds: 0,
        entry_count: 0,
      };
      const previous = await snapshotAndApply<Task>(queryClient, TASKS_KEY, (current) => [
        ...current,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onSuccess: (saved, _draft, context) => replaceRow(queryClient, TASKS_KEY, context.tempId, saved),
    onError: (error, _draft, context) => {
      rollback(queryClient, TASKS_KEY, context?.previous);
      showToast(errorMessage(error, "Could not save the task."));
    },
  });
}

/** Edit title/category/project or flip archived (archive/restore), optimistically. */
export function useEditTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => patchTask(id, patch),
    onMutate: async ({ id, patch }) => ({
      previous: await snapshotAndApply<Task>(queryClient, TASKS_KEY, (current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    }),
    onSettled: (saved, error, { id, patch }) => {
      syncFromServer(queryClient, TASKS_KEY, TASKS_MUTATION_KEY, saved, id);
      // Reassignment moves the task's tracked seconds between project totals.
      if (!error && patch.project !== undefined) {
        queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      }
    },
    onError: (error, _variables, context) => {
      rollback(queryClient, TASKS_KEY, context?.previous);
      showToast(errorMessage(error, "Could not update the task."));
    },
  });
}

/** Permanent delete — the backend cascades the task's time entries away. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => ({
      previous: await snapshotAndApply<Task>(queryClient, TASKS_KEY, (current) =>
        current.filter((item) => item.id !== id),
      ),
    }),
    // The cascade removed the task's entries from its project's total.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
    onError: (error, _id, context) => {
      rollback(queryClient, TASKS_KEY, context?.previous);
      showToast(errorMessage(error, "Could not delete the task."));
    },
  });
}
