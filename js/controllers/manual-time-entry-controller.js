import { Task } from "../domain/task.js";
import { TimeEntry } from "../domain/time-entry.js";
import { loadTasks, saveTasks, loadTimeEntries, saveTimeEntries } from "../data/storage.js";

export function createManualEntryController({ onEntryAdded } = {}) {
    function addManualEntry({ title, startedAt, endedAt }) {
        const taskTitle = (title ?? "").trim();
        if (!taskTitle) throw new Error("Manual entry requires a title");

        const start = new Date(startedAt);
        const end = new Date(endedAt);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new Error("Manual entry requires valid startedAt and endedAt");
        }

        const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
        if (durationSeconds <= 0) {
            throw new Error("endedAt must be after startedAt");
        }

        const tasks = loadTasks();
        const normalized = taskTitle.toLowerCase();

        let task = tasks.find((t) => (t.title ?? "").trim().toLowerCase() === normalized) ?? null;

        if (!task) {
            task = new Task({ title: taskTitle });
            tasks.push(task);
            saveTasks(tasks);
        }

        const entry = new TimeEntry({
            taskId: task.id,
            taskTitle: task.title,
            startedAt: start.toISOString(),
            endedAt: end.toISOString(),
            durationSeconds,
            notes: "",
        });

        const entries = loadTimeEntries();
        entries.push(entry);
        saveTimeEntries(entries);

        onEntryAdded?.({ entry, task });
    }

    return { addManualEntry };
}
