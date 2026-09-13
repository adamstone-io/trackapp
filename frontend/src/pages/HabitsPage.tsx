import { PageShell } from "../components/PageShell";
import { AddHabitForm } from "../features/habits/AddHabitForm";
import { HabitList } from "../features/habits/HabitList";

export function HabitsPage() {
  return (
    <PageShell>
      <HabitList />
      <AddHabitForm />
    </PageShell>
  );
}
