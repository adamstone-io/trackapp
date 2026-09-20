import { useState, type FormEvent } from "react";
import type { ActiveTimer, TimerMode } from "../../api/types";
import {
  addDurationFavorite,
  loadDurationFavorites,
  removeDurationFavorite,
} from "../../lib/durationFavorites";
import { formatTimerReadout } from "../../lib/time";
import {
  useActiveTimerQuery,
  useElapsedSeconds,
  usePauseTimer,
  useResumeTimer,
  useStartTimer,
} from "./useActiveTimer";
import { buildStopRequest, useStopTimer } from "./useTimeEntries";
import { ProjectSelect } from "../projects/ProjectSelect";
import styles from "./TimerControls.module.css";
import { capitalizeFirst } from "../../lib/text";

interface TimerControlsProps {
  /** The task title field is owned by the page so "Add moment" can read it too. */
  taskTitle: string;
  onTaskTitleChange: (value: string) => void;
}

export function TimerControls({ taskTitle, onTaskTitleChange }: TimerControlsProps) {
  const { data: timer } = useActiveTimerQuery();

  if (timer === undefined) return null;
  return timer ? (
    <RunningTimer timer={timer} />
  ) : (
    <StartTimerForm title={taskTitle} onTitleChange={onTaskTitleChange} />
  );
}

function StartTimerForm({ title, onTitleChange }: { title: string; onTitleChange: (value: string) => void }) {
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [favorites, setFavorites] = useState(loadDurationFavorites);
  const [projectId, setProjectId] = useState<string | null>(null);
  const start = useStartTimer();

  const targetSeconds = durationMinutes ? Number(durationMinutes) * 60 : 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "countdown" && targetSeconds <= 0) return;
    start.mutate(
      {
        payload: {
          task_title: title.trim() || "Untitled",
          task: null,
          started_at: new Date().toISOString(),
          elapsed_seconds: 0,
          is_paused: false,
          mode,
          target_duration: mode === "countdown" ? targetSeconds : null,
        },
        projectId,
      },
      { onSuccess: () => onTitleChange("") },
    );
  }

  return (
    <form className={styles.startForm} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="timer-task-title">
          Task
        </label>
        <input
          id="timer-task-title"
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="What are you working on?"
          autoComplete="off"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="timer-project">
          Project
        </label>
        <ProjectSelect
          id="timer-project"
          className={styles.input}
          value={projectId}
          onChange={setProjectId}
        />
      </div>
      <div className={styles.controlsRow}>
        <div className={styles.modeToggle} role="group" aria-label="Timer mode">
          <button
            className={mode === "stopwatch" ? styles.modeButtonActive : styles.modeButton}
            type="button"
            aria-pressed={mode === "stopwatch"}
            onClick={() => setMode("stopwatch")}
          >
            Stopwatch
          </button>
          <button
            className={mode === "countdown" ? styles.modeButtonActive : styles.modeButton}
            type="button"
            aria-pressed={mode === "countdown"}
            onClick={() => setMode("countdown")}
          >
            Countdown
          </button>
        </div>
        <button className={styles.startButton} type="submit">
          Start
        </button>
      </div>
      {mode === "countdown" && (
        <div className={styles.durationRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="timer-duration">
              Minutes
            </label>
            <input
              id="timer-duration"
              className={styles.durationInput}
              type="text"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value.replace(/\D/g, ""))}
              placeholder="25"
              autoComplete="off"
            />
          </div>
          <button
            className={styles.saveFavorite}
            type="button"
            aria-label="Save favorite"
            title="Save favorite"
            disabled={targetSeconds <= 0}
            onClick={() => setFavorites(addDurationFavorite(Number(durationMinutes)))}
          >
            ☆
          </button>
          <div className={styles.favorites} role="group" aria-label="Favorite durations">
            {favorites.map((favorite) => (
              <span key={favorite.id} className={styles.favorite}>
                <button
                  className={styles.favoriteApply}
                  type="button"
                  onClick={() => setDurationMinutes(String(Math.round(favorite.data.seconds / 60)))}
                >
                  {favorite.label}
                </button>
                <button
                  className={styles.favoriteRemove}
                  type="button"
                  aria-label={`Remove ${favorite.label}`}
                  onClick={() => setFavorites(removeDurationFavorite(favorite.id))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

function RunningTimer({ timer }: { timer: ActiveTimer }) {
  const elapsed = useElapsedSeconds(timer);
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const stopTimer = useStopTimer();

  const target = timer.mode === "countdown" ? timer.target_duration : null;
  const remaining = target ? Math.max(0, target - elapsed) : null;
  const percentUsed = target ? Math.min(100, Math.floor((elapsed / target) * 100)) : null;

  // The countdown's own ending is watched app-wide (useCountdownExpiry), not
  // here: this readout only exists while /timer is open, and a session does
  // not stop being over because the person navigated away from it.

  return (
    <div className={styles.running}>
      <div className={styles.readout} role="timer" aria-label={target ? "Remaining time" : "Elapsed time"}>
        {formatTimerReadout(remaining ?? elapsed)}
      </div>
      {percentUsed !== null && <div className={styles.percentUsed}>{percentUsed}% used</div>}
      <div className={styles.runningTitle}>{capitalizeFirst(timer.task_title)}</div>
      <div className={styles.actions}>
        {timer.is_paused ? (
          <button className={styles.secondaryButton} type="button" onClick={() => resumeTimer.resume(timer)}>
            Resume
          </button>
        ) : (
          <button className={styles.secondaryButton} type="button" onClick={() => pauseTimer.pause(timer)}>
            Pause
          </button>
        )}
        <button
          className={styles.stopButton}
          type="button"
          onClick={() => stopTimer.mutate(buildStopRequest(timer))}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
