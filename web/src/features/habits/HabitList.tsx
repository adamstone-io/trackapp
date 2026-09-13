import { useState, type FormEvent } from "react";
import type { Habit } from "../../api/types";
import {
  useBackfillHabit,
  useDeleteHabit,
  useEditHabit,
  useHabitsQuery,
  useLogHabit,
  useUnlogHabit,
} from "./useHabits";
import styles from "./HabitList.module.css";
import formStyles from "./AddHabitForm.module.css";
import { TargetField } from "./AddHabitForm";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";

/** Latest back-fillable date: yesterday, as a local "YYYY-MM-DD". */
function yesterdayIso(): string {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function HabitList() {
  const { data: habits } = useHabitsQuery();

  if (!habits) return null;
  const active = habits.filter((habit) => habit.is_active);
  const archived = habits.filter((habit) => !habit.is_active);

  return (
    <>
      {/* No heading — the highlighted nav link names the page. */}
      <section className={styles.section}>
        {active.length === 0 ? (
          <p className={styles.empty}>Start tracking your first habit.</p>
        ) : (
          <ul className={styles.list} aria-label="Habits">
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
  const [editing, setEditing] = useState(false);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const logMutation = useLogHabit();
  const unlogMutation = useUnlogHabit();
  const editMutation = useEditHabit();
  const deleteMutation = useDeleteHabit();

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
        {countersFor(habit).map(({ label, count, target }) => (
          <Counter key={label} label={label} count={count} target={target} />
        ))}
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
        <RowMenu
          name={habit.name}
          disabled={!isSettled(habit.id)}
          items={[
            { label: "Undo log", onSelect: () => unlogMutation.mutate(habit.id) },
            { label: "Log a past day", onSelect: () => setBackfillOpen(true) },
            { label: "Edit", onSelect: () => setEditing(true) },
            {
              label: "Archive",
              onSelect: () => editMutation.mutate({ id: habit.id, patch: { is_active: false } }),
            },
            {
              label: "Delete",
              danger: true,
              confirm: "Confirm delete",
              confirmNote: "Permanently removes the habit and its streak.",
              onSelect: () => deleteMutation.mutate(habit.id),
            },
          ]}
        />
      </div>
      {backfillOpen && <BackfillForm habit={habit} onDone={() => setBackfillOpen(false)} />}
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
      <div className={formStyles.targets}>
        <TargetField id={`edit-daily-${habit.id}`} label="Daily target" value={daily} onChange={setDaily} />
        <TargetField id={`edit-weekly-${habit.id}`} label="Weekly target" value={weekly} onChange={setWeekly} />
        <TargetField id={`edit-monthly-${habit.id}`} label="Monthly target" value={monthly} onChange={setMonthly} />
      </div>
      <div className={formStyles.buttons}>
        <button className={formStyles.saveButton} type="submit">
          Save
        </button>
        <button className={formStyles.cancelButton} type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Back-fill date form, revealed by the row menu's "Log a past day". */
function BackfillForm({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const [date, setDate] = useState("");
  const [count, setCount] = useState("1");
  const backfillMutation = useBackfillHabit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = parseInt(count, 10) || 0;
    if (!date || amount <= 0) return;
    backfillMutation.mutate({ id: habit.id, date, amount });
    onDone();
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
      <button className={styles.moreAction} type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

/** Only the periods the habit is actually aimed at: a daily habit's weekly and
 * monthly tallies are noise. A habit with no target at all still shows today's
 * count, or the row would have no number on it. */
function countersFor(habit: Habit) {
  const periods = [
    { label: "D", count: habit.daily_count, target: habit.daily_target },
    { label: "W", count: habit.weekly_count, target: habit.weekly_target },
    { label: "M", count: habit.monthly_count, target: habit.monthly_target },
  ];
  const targeted = periods.filter((period) => period.target > 0);
  return targeted.length > 0 ? targeted : [periods[0]];
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
