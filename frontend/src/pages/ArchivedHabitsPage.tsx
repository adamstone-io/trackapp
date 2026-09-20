import { PageShell } from "../components/PageShell";
import { ArchivedView } from "../components/ArchivedView";
import { useDeleteHabit, useEditHabit, useHabitsQuery } from "../features/habits/useHabits";

export function ArchivedHabitsPage() {
  const { data: habits } = useHabitsQuery();
  const editMutation = useEditHabit();
  const deleteMutation = useDeleteHabit();

  // A habit is retired by going inactive, not by an `archived` flag.
  const archived = (habits ?? []).filter((habit) => !habit.is_active);

  return (
    <PageShell>
      <ArchivedView
        title="Archived habits"
        backTo="/habits"
        backLabel="Habits"
        noun="habit"
        empty="Nothing archived yet."
        deleteNote="The habit and its logged history go for good."
        rows={archived.map((habit) => ({ id: habit.id, name: habit.name }))}
        onRestore={(id) => editMutation.mutate({ id, patch: { is_active: true } })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </PageShell>
  );
}
