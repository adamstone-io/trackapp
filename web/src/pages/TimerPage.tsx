import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { AddMomentButton } from "../features/timer/AddMomentButton";
import { ManualEntryForm } from "../features/timer/ManualEntryForm";
import { TimerControls } from "../features/timer/TimerControls";
import { TodayLog } from "../features/timer/TodayLog";
import styles from "./TimerPage.module.css";

export function TimerPage() {
  // Owned here so both the timer form and "Add moment" can use the same text.
  const [taskTitle, setTaskTitle] = useState("");

  return (
    <PageShell title="Timer">
      <TimerControls taskTitle={taskTitle} onTaskTitleChange={setTaskTitle} />
      <div className={styles.quickActions}>
        <ManualEntryForm />
        <AddMomentButton taskTitle={taskTitle} onAdded={() => setTaskTitle("")} />
      </div>
      <TodayLog />
    </PageShell>
  );
}
