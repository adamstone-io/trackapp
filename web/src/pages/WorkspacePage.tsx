import { PageShell } from "../components/PageShell";
import { ProjectSection } from "../features/projects/ProjectSection";

export function WorkspacePage() {
  return (
    <PageShell>
      <ProjectSection />
    </PageShell>
  );
}
