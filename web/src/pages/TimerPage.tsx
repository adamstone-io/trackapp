import { PageShell } from "../components/PageShell";
import { ManualEntryForm } from "../features/timer/ManualEntryForm";
import { TimerControls } from "../features/timer/TimerControls";
import { TodayLog } from "../features/timer/TodayLog";

export function TimerPage() {
  return (
    <PageShell title="Timer">
      <TimerControls />
      <ManualEntryForm />
      <TodayLog />
    </PageShell>
  );
}
