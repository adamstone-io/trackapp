import { PageShell } from "../components/PageShell";
import { ProjectSection } from "../features/projects/ProjectSection";
import { ScheduledTaskSection } from "../features/scheduledTasks/ScheduledTaskSection";

export function WorkspacePage() {
  return (
    <PageShell>
      <ProjectSection />
      {/* Beneath the projects: what's scheduled for a given day. */}
      <ScheduledTaskSection />
    </PageShell>
  );
}
