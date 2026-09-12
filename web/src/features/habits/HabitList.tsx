import { useState, type FormEvent } from "react";
import type { Habit } from "../../api/types";
import {
  useBackfillHabit,
  useEditHabit,
  useHabitsQuery,
  useLogHabit,
  useUnlogHabit,
} from "./useHabits";
import styles from "./HabitList.module.css";
import formStyles from "./AddHabitForm.module.css";
import { TargetField } from "./AddHabitForm";

/** Latest back-fillable date: yesterday, as a local "YYYY-MM-DD". */
function yesterdayIso(): string {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** A just-created optimistic row has no server id yet; let it settle first. */
function isSettled(id: string): boolean {
  return !id.startsWith("optimistic-");
}

export function HabitList() {
  const { data: habits } = useHabitsQuery();

  if (!habits) return null;
  const active = habits.filter((habit) => habit.is_active);
  const archived = habits.filter((habit) => !habit.is_active);

  return (
    <>
      <section className={styles.section}>
        <h2 id="habits-heading" className={styles.heading}>
          Habits
        </h2>
        {active.length === 0 ? (
          <p className={styles.empty}>No habits yet.</p>
        ) : (
          <ul className={styles.list} aria-labelledby="habits-heading">
            {active.map((habit) => (
              <li key={habit.id} className={styles.item}>
                <HabitRow habit={habit} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {archived.length > 0 && <ArchivedHabits habits={archived} />}
    </>
  );
}

function ArchivedHabits({ habits }: { habits: Habit[] }) {
  const editMutation = useEditHabit();
  return (
    <section className={styles.section}>
      <h2 id="archived-heading" className={styles.heading}>
        Archived
      </h2>
      <ul className={styles.list} aria-labelledby="archived-heading">
        {habits.map((habit) => (
          <li key={habit.id} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.archivedName}>{habit.name}</span>
            </div>
            <button
              className={styles.moreAction}
              type="button"
              aria-label={`Restore ${habit.name}`}
              disabled={!isSettled(habit.id)}
              onClick={() => editMutation.mutate({ id: habit.id, patch: { is_active: true } })}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HabitRow({ habit }: { habit: Habit }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const logMutation = useLogHabit();
  const unlogMutation = useUnlogHabit();
  const editMutation = useEditHabit();

  if (editing) {
    return <EditHabitForm habit={habit} onDone={() => setEditing(false)} />;
  }

  return (
    <>
      <div className={styles.main}>
        <span className={styles.name}>{habit.name}</span>
        {habit.streak_count > 0 && (
          <span className={styles.streak}>
            {habit.streak_count} day{habit.streak_count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className={styles.counters}>
        <Counter label="D" count={habit.daily_count} target={habit.daily_target} />
        <Counter label="W" count={habit.weekly_count} target={habit.weekly_target} />
        <Counter label="M" count={habit.monthly_count} target={habit.monthly_target} />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.logButton}
          type="button"
          aria-label={`Log ${habit.name}`}
          disabled={!isSettled(habit.id)}
          onClick={() => logMutation.mutate(habit.id)}
        >
          +1
        </button>
        <button
          className={styles.moreButton}
          type="button"
          aria-label={`More ${habit.name}`}
          aria-expanded={moreOpen}
          disabled={!isSettled(habit.id)}
          onClick={() => setMoreOpen((open) => !open)}
        >
          ⋯
        </button>
      </div>
      {moreOpen && (
        <div className={styles.moreRow}>
          <button
            className={styles.moreAction}
            type="button"
            onClick={() => unlogMutation.mutate(habit.id)}
          >
            Undo log
          </button>
          <BackfillForm habit={habit} />
          <button className={styles.moreAction} type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className={styles.moreAction}
            type="button"
            onClick={() => editMutation.mutate({ id: habit.id, patch: { is_active: false } })}
          >
            Archive
          </button>
        </div>
      )}
    </>
  );
}

/** Inline name/targets editor that replaces the habit's row while open. */
function EditHabitForm({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const [name, setName] = useState(habit.name);
  const [daily, setDaily] = useState(String(habit.daily_target));
  const [weekly, setWeekly] = useState(String(habit.weekly_target));
  const [monthly, setMonthly] = useState(String(habit.monthly_target));
  const editMutation = useEditHabit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    editMutation.mutate({
      id: habit.id,
      patch: {
        name: trimmed,
        daily_target: parseInt(daily, 10) || 0,
        weekly_target: parseInt(weekly, 10) || 0,
        monthly_target: parseInt(monthly, 10) || 0,
      },
    });
    onDone();
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`edit-name-${habit.id}`}>
          Name
        </label>
        <input
          id={`edit-name-${habit.id}`}
          className={formStyles.nameInput}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
      </div>
      <TargetField id={`edit-daily-${habit.id}`} label="Daily target" value={daily} onChange={setDaily} />
      <TargetField id={`edit-weekly-${habit.id}`} label="Weekly target" value={weekly} onChange={setWeekly} />
      <TargetField id={`edit-monthly-${habit.id}`} label="Monthly target" value={monthly} onChange={setMonthly} />
      <button className={formStyles.saveButton} type="submit">
        Save
      </button>
      <button className={formStyles.cancelButton} type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

/** "Log a past day" toggle plus the date form it reveals. */
function BackfillForm({ habit }: { habit: Habit }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [count, setCount] = useState("1");
  const backfillMutation = useBackfillHabit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = parseInt(count, 10) || 0;
    if (!date || amount <= 0) return;
    backfillMutation.mutate({ id: habit.id, date, amount });
    setOpen(false);
    setDate("");
    setCount("1");
  }

  if (!open) {
    return (
      <button className={styles.moreAction} type="button" onClick={() => setOpen(true)}>
        Log a past day
      </button>
    );
  }

  return (
    <form className={styles.backfillForm} onSubmit={handleSubmit}>
      <label className={styles.backfillLabel} htmlFor={`backfill-${habit.id}`}>
        Date
      </label>
      <input
        id={`backfill-${habit.id}`}
        className={styles.backfillDate}
        type="date"
        value={date}
        max={yesterdayIso()}
        onChange={(event) => setDate(event.target.value)}
        autoFocus
        required
      />
      <label className={styles.backfillLabel} htmlFor={`backfill-count-${habit.id}`}>
        Count
      </label>
      <input
        id={`backfill-count-${habit.id}`}
        className={styles.backfillCount}
        type="number"
        min="1"
        value={count}
        onChange={(event) => setCount(event.target.value)}
        required
      />
      <button className={styles.moreAction} type="submit">
        Log
      </button>
      <button className={styles.moreAction} type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function Counter({ label, count, target }: { label: string; count: number; target: number }) {
  const met = target > 0 && count >= target;
  return (
    <span className={met ? styles.counterMet : undefined}>
      {label}
      <span className={styles.counterValue}>{target > 0 ? `${count}/${target}` : count}</span>
    </span>
  );
}
