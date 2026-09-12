import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backfillHabit,
  createHabit,
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

export function useLogHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => logHabit(id),
    onMutate: (id) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => ({
          daily_count: habit.daily_count + 1,
          weekly_count: habit.weekly_count + 1,
          monthly_count: habit.monthly_count + 1,
        })),
      ),
    // The server's answer carries the authoritative streak.
    onSuccess: (saved) => replaceHabit(queryClient, saved.id, saved),
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
    mutationFn: (id: string) => unlogHabit(id),
    onMutate: (id) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => ({
          daily_count: Math.max(0, habit.daily_count - 1),
          weekly_count: Math.max(0, habit.weekly_count - 1),
          monthly_count: Math.max(0, habit.monthly_count - 1),
        })),
      ),
    onSuccess: (saved) => replaceHabit(queryClient, saved.id, saved),
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
function backfillPatch(habit: Habit, isoDate: string): Partial<Habit> {
  const [year, month, dayOfMonth] = isoDate.split("-").map(Number);
  const day = new Date(year, month - 1, dayOfMonth);
  const now = new Date();
  const patch: Partial<Habit> = {};
  if (startOfWeekMs(day) === startOfWeekMs(now)) {
    patch.weekly_count = habit.weekly_count + 1;
  }
  if (day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth()) {
    patch.monthly_count = habit.monthly_count + 1;
  }
  return patch;
}

export function useBackfillHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => backfillHabit(id, date),
    onMutate: ({ id, date }) =>
      snapshotAndApply(queryClient, (current) =>
        patchInList(current, id, (habit) => backfillPatch(habit, date)),
      ),
    onSuccess: (saved) => replaceHabit(queryClient, saved.id, saved),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not log the past day.");
    },
  });
}

/** Edit name/targets or flip is_active (archive/restore), optimistically. */
export function useEditHabit() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: HabitPatch }) => patchHabit(id, patch),
    onMutate: ({ id, patch }) =>
      snapshotAndApply(queryClient, (current) => patchInList(current, id, () => patch)),
    onSuccess: (saved) => replaceHabit(queryClient, saved.id, saved),
    onError: (error, _variables, context) => {
      rollback(queryClient, context?.previous);
      showToast(error instanceof Error ? error.message : "Could not update the habit.");
    },
  });
}
