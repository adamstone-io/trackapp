import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScheduledTask,
  deleteTask,
  listScheduledTasks,
  patchTask,
  type ScheduledTaskCreate,
  type ScheduledTaskPatch,
} from "../../api/tasks";
import type { Task } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";
import { isSettled } from "../../lib/optimistic";

export const SCHEDULED_TASKS_KEY = ["scheduled-tasks"];

/** Shared key for per-task mutations, so a late response can tell whether
 * newer mutations for the same row are still in flight (habits' rule). */
const TASK_MUTATION_KEY = [...SCHEDULED_TASKS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

function dayKey(date: string) {
  return [...SCHEDULED_TASKS_KEY, date];
}

export function useScheduledTasksQuery(date: string) {
  return useQuery({ queryKey: dayKey(date), queryFn: () => listScheduledTasks(date) });
}

async function snapshotAndApply(
  queryClient: QueryClient,
  date: string,
  apply: (current: Task[]) => Task[],
): Promise<Task[] | undefined> {
  await queryClient.cancelQueries({ queryKey: dayKey(date) });
  const previous = queryClient.getQueryData<Task[]>(dayKey(date));
  queryClient.setQueryData<Task[]>(dayKey(date), (current) => apply(current ?? []));
  return previous;
}

function rollback(queryClient: QueryClient, date: string, previous: Task[] | undefined) {
  queryClient.setQueryData(dayKey(date), previous ?? []);
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** The list is ordered by planned start, so an optimistic row has to slot in. */
export function byPlannedStart(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => Date.parse(a.planned_start ?? "") - Date.parse(b.planned_start ?? ""),
  );
}

export function useCreateScheduledTask(date: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: ScheduledTaskCreate) => createScheduledTask(draft),
    onMutate: async (draft) => {
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const optimistic: Task = {
        id: tempId,
        title: draft.title,
        category: "other",
        project: draft.project,
        notes: draft.notes,
        archived: false,
        total_seconds: 0,
        entry_count: 0,
        planned_start: draft.planned_start,
        planned_duration: draft.planned_duration,
        first_started_at: null,
      };
      const previous = await snapshotAndApply(queryClient, date, (current) =>
        byPlannedStart([...current, optimistic]),
      );
      return { previous, tempId };
    },
    onSuccess: (saved, _draft, context) => {
      queryClient.setQueryData<Task[]>(dayKey(date), (current) =>
        byPlannedStart((current ?? []).map((task) => (task.id === context.tempId ? saved : task))),
      );
    },
    onError: (error, _draft, context) => {
      rollback(queryClient, date, context?.previous);
      showToast(message(error, "Could not schedule the task."));
    },
  });
}

export function useEditScheduledTask(date: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: TASK_MUTATION_KEY,
    mutationFn: ({ id, patch }: { id: string; patch: ScheduledTaskPatch }) => patchTask(id, patch),
    onMutate: async ({ id, patch }) => ({
      previous: await snapshotAndApply(queryClient, date, (current) =>
        byPlannedStart(current.map((task) => (task.id === id ? { ...task, ...patch } : task))),
      ),
    }),
    onSettled: (saved, _error, { id }) => {
      if (!saved) return;
      const inFlight = queryClient.isMutating({
        mutationKey: TASK_MUTATION_KEY,
        predicate: (mutation) => (mutation.state.variables as { id: string }).id === id,
      });
      if (inFlight <= 1) {
        queryClient.setQueryData<Task[]>(dayKey(date), (current) =>
          byPlannedStart((current ?? []).map((task) => (task.id === saved.id ? saved : task))),
        );
      }
    },
    onError: (error, _variables, context) => {
      rollback(queryClient, date, context?.previous);
      showToast(message(error, "Could not update the task."));
    },
  });
}

export function useDeleteScheduledTask(date: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => ({
      previous: await snapshotAndApply(queryClient, date, (current) =>
        current.filter((task) => task.id !== id),
      ),
    }),
    onError: (error, _id, context) => {
      rollback(queryClient, date, context?.previous);
      showToast(message(error, "Could not delete the task."));
    },
  });
}

export { isSettled };
