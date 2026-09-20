import { useEffect } from "react";
import type { ActiveTimer } from "../../api/types";
import { playTimerFinishedSound } from "../../lib/sounds";
import { computeElapsedSeconds, useActiveTimerQuery } from "./useActiveTimer";
import { buildStopRequest, useStopTimer } from "./useTimeEntries";

/**
 * The session whose expiry has already been acted on.
 *
 * Module-level, not a ref. A ref dies with the component holding it, and this
 * check used to sit on the timer page: every return to /timer was a fresh
 * guard over an already-expired countdown, so it sounded the alarm and wrote
 * another entry — same title, same times as the one before.
 *
 * Keyed by id and start together, because a stop deletes the row and a start
 * creates a new one; the pair cannot repeat for two different sessions.
 */
let autoStopped: string | null = null;

function sessionKey(timer: ActiveTimer): string {
  return `${timer.id}:${timer.created_at}`;
}

/**
 * When the countdown actually ran out, which is not always now: a tab that was
 * closed, asleep, or simply on another page notices late. The entry should
 * record the session that was asked for, not how long it took to come back.
 */
function expiryMs(timer: ActiveTimer, target: number, nowMs: number): number {
  const overrunSeconds = Math.max(0, computeElapsedSeconds(timer, nowMs) - target);
  return nowMs - overrunSeconds * 1000;
}

/**
 * A countdown that runs out ends its own session, wherever the person is.
 *
 * Mounted once, in the app layout. It used to live in the timer page's running
 * readout, which exists only while /timer is open — so a countdown that
 * expired on another page just kept running: no alarm, a nav bar stuck at
 * 00:00, and a stop that waited for someone to come back and trigger it.
 */
export function useCountdownExpiry() {
  const { data: timer } = useActiveTimerQuery();
  const stopTimer = useStopTimer();

  useEffect(() => {
    const target = timer?.mode === "countdown" ? timer.target_duration : null;
    if (!timer || !target || timer.is_paused) return;

    const fire = () => {
      if (autoStopped === sessionKey(timer)) return;
      autoStopped = sessionKey(timer);
      playTimerFinishedSound();
      const nowMs = Date.now();
      stopTimer.mutate(buildStopRequest(timer, expiryMs(timer, target, nowMs)));
    };

    // One timeout for the remaining time, rather than a tick that re-renders
    // the whole layout every half second to ask "is it over yet".
    const remainingMs = (target - computeElapsedSeconds(timer, Date.now())) * 1000;
    if (remainingMs <= 0) {
      fire();
      return;
    }
    const pending = setTimeout(fire, remainingMs);
    return () => clearTimeout(pending);
    // The timer is what this watches; mutate is stable across renders.
  }, [timer]); // eslint-disable-line react-hooks/exhaustive-deps
}
