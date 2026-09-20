import { PageShell } from "../components/PageShell";
import { ArchivedView } from "../components/ArchivedView";
import { ColorDot } from "../features/projects/ProjectSection";
import { useDeleteProject, useEditProject, useProjectsQuery } from "../features/projects/useProjects";

export function ArchivedProjectsPage() {
  const { data: projects } = useProjectsQuery();
  const editMutation = useEditProject();
  const deleteMutation = useDeleteProject();

  const archived = (projects ?? []).filter((project) => project.archived);

  return (
    <PageShell>
      <ArchivedView
        title="Archived projects"
        backTo="/workspace"
        backLabel="Workspace"
        noun="project"
        empty="Nothing archived yet."
        deleteNote="Tasks keep their history and become unassigned."
        rows={archived.map((project) => ({
          id: project.id,
          name: project.name,
          badge: <ColorDot color={project.color} />,
        }))}
        onRestore={(id) => editMutation.mutate({ id, patch: { archived: false } })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </PageShell>
  );
}
