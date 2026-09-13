import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createActiveTimer,
  getActiveTimer,
  patchActiveTimer,
  type ActiveTimerCreate,
} from "../../api/timer";
import type { ActiveTimer } from "../../api/types";
import { ensureTaskId } from "../../api/tasks";
import { useToast } from "../../components/toast/ToastProvider";

export const ACTIVE_TIMER_KEY = ["active-timer"];

/** Shared by every timer mutation, so polling can stand down while one runs. */
export const TIMER_MUTATION_KEY = [...ACTIVE_TIMER_KEY, "mutate"];

/** R9c: a timer started on another device has to show up here. The server row
 * is the only shared truth, so it is polled — push would mean ASGI, Channels
 * and a broker this project doesn't run. */
const TIMER_POLL_MS = 2000;

export function useActiveTimerQuery() {
  // A poll that lands mid-mutation would answer with state the user has
  // already moved past, rewinding an optimistic pause or resurrecting a
  // stopped timer. Stand down until the mutation settles.
  const mutating = useIsMutating({ mutationKey: TIMER_MUTATION_KEY });

  return useQuery({
    queryKey: ACTIVE_TIMER_KEY,
    queryFn: getActiveTimer,
    // refetchIntervalInBackground stays false: a hidden tab polls nothing.
    refetchInterval: mutating > 0 ? false : TIMER_POLL_MS,
    staleTime: 0,
  });
}

/**
 * A timer that disappears between polls was stopped somewhere else, and that
 * stop produced a time entry this tab has never seen — so the day's log has to
 * be refetched. Mounted once, in the app layout.
 */
/** A stop *here* clears the timer too, and that path writes its own entry into
 * the log — so it says so, rather than the sync hook inferring it from mutation
 * state, which depends on render timing. */
let stoppedLocally = false;

export function markLocalTimerStop() {
  stoppedLocally = true;
}

export function useTimerSync() {
  const queryClient = useQueryClient();
  const { data: timer } = useActiveTimerQuery();
  const hadTimer = useRef(false);

  useEffect(() => {
    const hasTimer = Boolean(timer);
    if (hadTimer.current && !hasTimer) {
      if (stoppedLocally) {
        stoppedLocally = false;
      } else {
        // Stopped on another device: the entry it produced is news to this tab.
        queryClient.invalidateQueries({ queryKey: ["today-entries"] });
      }
    }
    hadTimer.current = hasTimer;
  }, [timer, queryClient]);
}

/** Starting with a project resolves the task up front so the association
 * survives pauses and reloads — ActiveTimer persists the task FK, not a
 * project. Untagged timers still resolve their task at stop, as before. */
export interface StartTimerRequest {
  payload: ActiveTimerCreate;
  projectId?: string | null;
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationKey: TIMER_MUTATION_KEY,
    mutationFn: async ({ payload, projectId }: StartTimerRequest) =>
      createActiveTimer(
        projectId
          ? { ...payload, task: await ensureTaskId(payload.task_title, projectId) }
          : payload,
      ),
    onMutate: async ({ payload }) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_KEY });
      const previous = queryClient.getQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY);
      const optimistic: ActiveTimer = {
        id: 0,
        created_at: payload.started_at,
        ...payload,
      };
      queryClient.setQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY, optimistic);
      return { previous };
    },
    onSuccess: (timer) => {
      queryClient.setQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY, timer);
    },
    onError: (error, _payload, context) => {
      queryClient.setQueryData(ACTIVE_TIMER_KEY, context?.previous ?? null);
      showToast(error instanceof Error ? error.message : "Could not start the timer.");
    },
  });
}

/** Optimistically applies a patch to the cached timer, rolling back on error. */
function usePatchTimer() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationKey: TIMER_MUTATION_KEY,
    mutationFn: (patch: Partial<ActiveTimerCreate>) => patchActiveTimer(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_KEY });
      const previous = queryClient.getQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY);
      if (previous) {
        queryClient.setQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY, { ...previous, ...patch });
      }
      return { previous };
    },
    onSuccess: (timer) => {
      queryClient.setQueryData<ActiveTimer | null>(ACTIVE_TIMER_KEY, timer);
    },
    onError: (error, _patch, context) => {
      queryClient.setQueryData(ACTIVE_TIMER_KEY, context?.previous ?? null);
      showToast(error instanceof Error ? error.message : "Could not update the timer.");
    },
  });
}

export function usePauseTimer() {
  const patch = usePatchTimer();
  return {
    ...patch,
    pause: (timer: ActiveTimer) =>
      patch.mutate({
        is_paused: true,
        elapsed_seconds: computeElapsedSeconds(timer, Date.now()),
      }),
  };
}

export function useResumeTimer() {
  const patch = usePatchTimer();
  return {
    ...patch,
    resume: (timer: ActiveTimer) =>
      patch.mutate({
        is_paused: false,
        started_at: new Date().toISOString(),
        elapsed_seconds: timer.elapsed_seconds,
      }),
  };
}

/**
 * Total elapsed seconds for a timer: the checkpointed elapsed_seconds plus,
 * while running, the wall-clock time since the current segment started.
 */
export function computeElapsedSeconds(timer: ActiveTimer, nowMs: number): number {
  if (timer.is_paused) return timer.elapsed_seconds;
  const segment = Math.floor((nowMs - Date.parse(timer.started_at)) / 1000);
  return timer.elapsed_seconds + Math.max(0, segment);
}

/** Re-renders every second while the timer runs so the readout stays live. */
export function useElapsedSeconds(timer: ActiveTimer | null | undefined): number {
  const running = !!timer && !timer.is_paused;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [running, timer?.started_at]);

  if (!timer) return 0;
  return computeElapsedSeconds(timer, nowMs);
}
