import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backfillHabit,
  createHabit,
  deleteHabit,
  listAllHabits,
  logHabit,
  patchHabit,
  unlogHabit,
  type HabitCreate,
  type HabitPatch,
} from "../../api/habits";
import type { Habit } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";

export const HABITS_KEY = ["habits"];

/** Shared key for the per-habit mutations (log/unlog/back-fill/edit) so a
 * late response can tell whether newer mutations are still in flight. */
const HABITS_MUTATION_KEY = [...HABITS_KEY, "mutate"];

type QueryClient = ReturnType<typeof useQueryClient>;

export function useHabitsQuery() {
  return useQuery({ queryKey: HABITS_KEY, queryFn: listAllHabits });
}

/** Snapshot the cache and apply an optimistic change; returns rollback state. */
async function snapshotAndApply(
  queryClient: QueryClient,
  apply: (current: Habit[]) => Habit[],
): Promise<{ previous: Habit[] | undefined }> {
  await queryClient.cancelQueries({ queryKey: HABITS_KEY });
  const previous = queryClient.getQueryData<Habit[]>(HABITS_KEY);
  queryClient.setQueryData<Habit[]>(HABITS_KEY, (current) => apply(current ?? []));
  return { previous };
}

function replaceHabit(queryClient: QueryClient, id: string, saved: Habit) {
  queryClient.setQueryData<Habit[]>(HABITS_KEY, (current) =>
    current?.map((habit) => (habit.id === id ? saved : habit)),
  );
}

function rollback(queryClient: QueryClient, previous: Habit[] | undefined) {
  queryClient.setQueryData(HABITS_KEY, previous ?? []);
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: HabitCreate) => createHabit(draft),
    onMutate: async (draft) => {
      const tempId = `optimistic-${draft.name}`;
      const optimistic: Habit = {
        id: tempId,
        ...draft,
        daily_count: 0,
        weekly_count: 0,
        monthly_count: 0,
        is_active: true,
        streak_count: 0,
        last_completed_date: null,
        last_logged_at: null,
        recent_completions: [],
      };
      const context = await snapshotAndApply(queryClient, (current) => [...current, optimistic]);
      return { ...context, tempId };
    },
    onSuccess: (saved, _draft, context) => replaceHabit(queryClient, context.tempId, saved),
    onError: (error, _draft, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not save the habit.");
    },
  });
}

/** Apply a patch to one habit in the cached list. */
function patchInList(current: Habit[], id: string, patch: (habit: Habit) => Partial<Habit>): Habit[] {
  return current.map((habit) => (habit.id === id ? { ...habit, ...patch(habit) } : habit));
}

function habitIdOf(variables: unknown): string {
  return typeof variables === "string" ? variables : (variables as { id: string }).id;
}

/** Sync the server's authoritative row (it carries the streak) — but only
 * when this is the habit's last in-flight mutation. An earlier response
 * landing late would visibly rewind counters that newer optimistic
 * updates already advanced; the newest response supersedes it anyway. */
function syncFromServer(queryClient: QueryClient, saved: Habit | undefined, id: string) {
  if (!saved) return;
  const inFlight = queryClient.isMutating({
    mutationKey: HABITS_MUTATION_KEY,
    predicate: (mutation) => habitIdOf(mutation.state.variables) === id,
  });
  if (inFlight <= 1) replaceHabit(queryClient, saved.id, saved);
}

export function useLogHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: HABITS_MUTATION_KEY,
    mutationFn: (id: string) => logHabit(id),
    onMutate: (id) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => ({
          daily_count: habit.daily_count + 1,
          weekly_count: habit.weekly_count + 1,
          monthly_count: habit.monthly_count + 1,
        })),
      ),
    onSettled: (saved, _error, id) => syncFromServer(queryClient, saved, id),
    onError: (error, _id, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not log the habit.");
    },
  });
}

export function useUnlogHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: HABITS_MUTATION_KEY,
    mutationFn: (id: string) => unlogHabit(id),
    onMutate: (id) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => ({
          daily_count: Math.max(0, habit.daily_count - 1),
          weekly_count: Math.max(0, habit.weekly_count - 1),
          monthly_count: Math.max(0, habit.monthly_count - 1),
        })),
      ),
    onSettled: (saved, _error, id) => syncFromServer(queryClient, saved, id),
    onError: (error, _id, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not undo the log.");
    },
  });
}

/** Monday-start week beginning, matching the backend's boundary rule. */
function startOfWeekMs(day: Date): number {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}

/** The optimistic counterpart of a back-fill: only the counters whose
 * period contains the past date move; today's daily count never does. */
function backfillPatch(habit: Habit, isoDate: string, amount: number): Partial<Habit> {
  const [year, month, dayOfMonth] = isoDate.split("-").map(Number);
  const day = new Date(year, month - 1, dayOfMonth);
  const now = new Date();
  const patch: Partial<Habit> = {};
  if (startOfWeekMs(day) === startOfWeekMs(now)) {
    patch.weekly_count = habit.weekly_count + amount;
  }
  if (day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth()) {
    patch.monthly_count = habit.monthly_count + amount;
  }
  return patch;
}

export function useBackfillHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: HABITS_MUTATION_KEY,
    mutationFn: ({ id, date, amount }: { id: string; date: string; amount: number }) =>
      backfillHabit(id, date, amount),
    onMutate: ({ id, date, amount }) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => backfillPatch(habit, date, amount)),
      ),
    onSettled: (saved, _error, { id }) => syncFromServer(queryClient, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not log the past day.");
    },
  });
}

/** Permanent delete, optimistically removed from the list. */
export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: HABITS_MUTATION_KEY,
    mutationFn: (id: string) => deleteHabit(id),
    onMutate: (id) =>
      snapshotAndApply(queryClient, (current) => current.filter((habit) => habit.id !== id)),
    onError: (error, _id, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not delete the habit.");
    },
  });
}

/** Edit name/targets or flip is_active (archive/restore), optimistically. */
export function useEditHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationKey: HABITS_MUTATION_KEY,
    mutationFn: ({ id, patch }: { id: string; patch: HabitPatch }) => patchHabit(id, patch),
    onMutate: ({ id, patch }) =>
      snapshotAndApply(queryClient, (current) => patchInList(current, id, () => patch)),
    onSettled: (saved, _error, { id }) => syncFromServer(queryClient, saved, id),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not update the habit.");
    },
  });
}
