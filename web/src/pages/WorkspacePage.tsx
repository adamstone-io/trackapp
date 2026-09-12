import { PageShell } from "../components/PageShell";
import { ProjectSection } from "../features/workspace/ProjectSection";
import { TaskSection } from "../features/workspace/TaskSection";

export function WorkspacePage() {
  return (
    <PageShell>
      <ProjectSection />
      <TaskSection />
    </PageShell>
  );
}
