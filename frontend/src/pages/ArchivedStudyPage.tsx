import { PageShell } from "../components/PageShell";
import { ArchivedView } from "../components/ArchivedView";
import { ListFoot } from "../features/study/ListFoot";
import { useDeleteStudyItem, useEditStudyItem, useStudyList } from "../features/study/useStudyItems";

export function ArchivedStudyPage() {
  const list = useStudyList({ archived: true });
  const editMutation = useEditStudyItem();
  const deleteMutation = useDeleteStudyItem();

  return (
    <PageShell>
      <ArchivedView
        title="Archived study items"
        backTo="/study"
        backLabel="Study"
        noun="study item"
        empty="Nothing archived yet."
        deleteNote="The item and its history go for good. Restoring is no longer possible."
        // An image prompt has no text to borrow, the way quick moments fall back.
        rows={list.items.map((item) => ({ id: item.id, name: item.prompt.trim() || "Untitled" }))}
        onRestore={(id) => editMutation.mutate({ id, patch: { is_archived: false } })}
        onDelete={(id) => deleteMutation.mutate(id)}
        // Archives grow without limit, so this list pages like the live one.
        footer={<ListFoot list={list} label="archived study items" />}
      />
    </PageShell>
  );
}
