import { useState, type FormEvent } from "react";
import { useCreateHabit } from "./useHabits";
import styles from "./AddHabitForm.module.css";

export function AddHabitForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const createHabit = useCreateHabit();

  function handleClose() {
    setOpen(false);
    setName("");
    setDaily("");
    setWeekly("");
    setMonthly("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createHabit.mutate({
      name: trimmed,
      daily_target: parseInt(daily, 10) || 0,
      weekly_target: parseInt(weekly, 10) || 0,
      monthly_target: parseInt(monthly, 10) || 0,
    });
    handleClose();
  }

  if (!open) {
    return (
      <button className={styles.openButton} type="button" onClick={() => setOpen(true)}>
        Add habit
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="habit-name">
          Name
        </label>
        <input
          id="habit-name"
          className={styles.nameInput}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
      </div>
      <div className={styles.targets}>
        <TargetField id="habit-daily" label="Daily target" value={daily} onChange={setDaily} />
        <TargetField id="habit-weekly" label="Weekly target" value={weekly} onChange={setWeekly} />
        <TargetField id="habit-monthly" label="Monthly target" value={monthly} onChange={setMonthly} />
      </div>
      <div className={styles.buttons}>
        <button className={styles.saveButton} type="submit">
          Save
        </button>
        <button className={styles.cancelButton} type="button" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Labeled number input for one of the three targets; shared with the edit form. */
export function TargetField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.targetInput}
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
