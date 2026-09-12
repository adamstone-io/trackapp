import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMoment, createTimeEntry, patchMoment, type MomentCreate } from "../../api/entries";
import { ensureTaskId } from "../../api/tasks";
import { deleteActiveTimer } from "../../api/timer";
import type { ActiveTimer, TimeEntry, TodayEntry } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";
import { ACTIVE_TIMER_KEY, computeElapsedSeconds } from "./useActiveTimer";

export const TODAY_ENTRIES_KEY = ["today-entries"];

type QueryClient = ReturnType<typeof useQueryClient>;

/** A time entry about to be recorded — from stopping a timer or the manual form. */
export interface EntryDraft {
  taskTitle: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  /** Known task id; when absent one is resolved (or created) by title. */
  taskId?: string | null;
}

async function persistEntry(draft: EntryDraft): Promise<TimeEntry> {
  const taskId = draft.taskId ?? (await ensureTaskId(draft.taskTitle));
  return createTimeEntry({
    task: taskId,
    task_title: draft.taskTitle,
    started_at: draft.startedAt,
    ended_at: draft.endedAt,
    duration_seconds: draft.durationSeconds,
    notes: "",
    breaks: [],
  });
}

async function prependOptimisticEntry(queryClient: QueryClient, draft: EntryDraft) {
  await queryClient.cancelQueries({ queryKey: TODAY_ENTRIES_KEY });
  const previousEntries = queryClient.getQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY);
  const tempId = `optimistic-${draft.endedAt}`;
  const optimistic: TodayEntry = {
    type: "time_entry",
    id: tempId,
    sort_time: draft.startedAt,
    data: {
      id: tempId,
      task: draft.taskId ?? null,
      task_title: draft.taskTitle,
      started_at: draft.startedAt,
      ended_at: draft.endedAt,
      duration_seconds: draft.durationSeconds,
      notes: "",
      breaks: [],
    },
  };
  queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) => [
    optimistic,
    ...(current ?? []),
  ]);
  return { previousEntries, tempId };
}

function confirmOptimisticEntry(queryClient: QueryClient, tempId: string, saved: TimeEntry) {
  queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) =>
    current?.map((entry) =>
      entry.type === "time_entry" && entry.id === tempId
        ? { type: "time_entry", id: saved.id, sort_time: saved.started_at, data: saved }
        : entry,
    ),
  );
}

function rollbackOptimisticEntry(queryClient: QueryClient, previousEntries: TodayEntry[] | undefined) {
  queryClient.setQueryData(TODAY_ENTRIES_KEY, previousEntries ?? []);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not save the time entry.";
}

export function useAddManualEntry() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: EntryDraft) => persistEntry(draft),
    onMutate: (draft) => prependOptimisticEntry(queryClient, draft),
    onSuccess: (saved, _draft, context) => confirmOptimisticEntry(queryClient, context.tempId, saved),
    onError: (error, _draft, context) => {
      rollbackOptimisticEntry(queryClient, context?.previousEntries);
      showToast(errorMessage(error));
    },
  });
}

export function useAddMoment() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (draft: MomentCreate) => createMoment(draft),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: TODAY_ENTRIES_KEY });
      const previousEntries = queryClient.getQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY);
      const tempId = `optimistic-moment-${draft.timestamp}`;
      const optimistic: TodayEntry = {
        type: "moment",
        id: tempId,
        sort_time: draft.timestamp,
        data: {
          id: tempId,
          description: draft.description,
          category: "general",
          timestamp: draft.timestamp,
          task: null,
          task_title: "",
          is_milestone: false,
        },
      };
      queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { previousEntries, tempId };
    },
    onSuccess: (saved, _draft, context) => {
      queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) =>
        current?.map((entry) =>
          entry.type === "moment" && entry.id === context.tempId
            ? { type: "moment", id: saved.id, sort_time: saved.timestamp, data: saved }
            : entry,
        ),
      );
    },
    onError: (error, _draft, context) => {
      rollbackOptimisticEntry(queryClient, context?.previousEntries);
      showToast(error instanceof Error ? error.message : "Could not save the moment.");
    },
  });
}

export function useRenameMoment() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      patchMoment(id, { description }),
    onMutate: async ({ id, description }) => {
      await queryClient.cancelQueries({ queryKey: TODAY_ENTRIES_KEY });
      const previousEntries = queryClient.getQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY);
      queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) =>
        current?.map((entry) =>
          entry.type === "moment" && entry.id === id
            ? { ...entry, data: { ...entry.data, description } }
            : entry,
        ),
      );
      return { previousEntries };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<TodayEntry[]>(TODAY_ENTRIES_KEY, (current) =>
        current?.map((entry) =>
          entry.type === "moment" && entry.id === saved.id ? { ...entry, data: saved } : entry,
        ),
      );
    },
    onError: (error, _variables, context) => {
      rollbackOptimisticEntry(queryClient, context?.previousEntries);
      showToast(error instanceof Error ? error.message : "Could not rename the moment.");
    },
  });
}

/** Everything needed to turn a running timer into a time entry, frozen at click time. */
export interface StopRequest {
  timer: ActiveTimer;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export function buildStopRequest(timer: ActiveTimer, nowMs = Date.now()): StopRequest {
  return {
    timer,
    // created_at marks when the session actually began; started_at only marks
    // the current segment (it is reset on every resume).
    startedAt: timer.created_at,
    endedAt: new Date(nowMs).toISOString(),
    durationSeconds: computeElapsedSeconds(timer, nowMs),
  };
}

function stopDraft(request: StopRequest): EntryDraft {
  return {
    taskTitle: request.timer.task_title,
    startedAt: request.startedAt,
    endedAt: request.endedAt,
    durationSeconds: request.durationSeconds,
    taskId: request.timer.task,
  };
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (request: StopRequest) => {
      const saved = await persistEntry(stopDraft(request));
      // Only clear the server-side timer once the entry is safely recorded; a
      // failure here is harmless — the next refetch just resurrects the timer.
      await deleteActiveTimer().catch(() => {});
      return saved;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_KEY });
      const previousTimer = queryClient.getQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY);
      queryClient.setQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY, null);
      const entryContext = await prependOptimisticEntry(queryClient, stopDraft(request));
      return { previousTimer, ...entryContext };
    },
    onSuccess: (saved, _request, context) => confirmOptimisticEntry(queryClient, context.tempId, saved),
    onError: (error, _request, context) => {
      rollbackOptimisticEntry(queryClient, context?.previousEntries);
      // The timer was never deleted server-side, so the session is still live.
      queryClient.setQueryData(ACTIVE_TIMER_KEY, context?.previousTimer ?? null);
      showToast(errorMessage(error));
    },
  });
}
