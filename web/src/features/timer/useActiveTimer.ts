import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createActiveTimer,
  getActiveTimer,
  patchActiveTimer,
  type ActiveTimerCreate,
} from "../../api/timer";
import type { ActiveTimer } from "../../api/types";
import { useToast } from "../../components/toast/ToastProvider";

export const ACTIVE_TIMER_KEY = ["active-timer"];

export function useActiveTimerQuery() {
  return useQuery({
    queryKey: ACTIVE_TIMER_KEY,
    queryFn: getActiveTimer,
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (payload: ActiveTimerCreate) => createActiveTimer(payload),
    onMutate: async (payload) => {
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
