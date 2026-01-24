import { Moment } from "../domain/moment.js";
import { TimeEntry } from "../domain/time-entry.js";
import { Task } from "../domain/task.js";

const STORAGE_KEYS = {
    moments: "moments",
    timeEntries: "timeEntries",
    tasks: "tasks",
    activeTimer: "activeTimer",
};

// ========== MOMENTS ==========

export function saveMoments(moments) {
    const data = moments.map((m) => m.toJSON());
    localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data));
}

export function loadMoments() {
    const raw = localStorage.getItem(STORAGE_KEYS.moments);
    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return data.map((item) => Moment.fromJSON(item));
    } catch (error) {
        console.error("Failed to load moments:", error);
        return [];
    }
}

export function updateMoment(id, patch) {
    const raw = localStorage.getItem(STORAGE_KEYS.moments);
    const data = raw ? JSON.parse(raw) : [];

    const index = data.findIndex((m) => m.id === id);
    if (index === -1) return false;

    const current = data[index];
    data[index] = {
        ...current,
        ...patch,
        id: current.id,
    };

    localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data));
    return true;
}

// ========== TASKS ==========

export function saveTasks(tasks) {
    const data = tasks.map((t) => t.toJSON());
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data));
}

export function loadTasks() {
    const raw = localStorage.getItem(STORAGE_KEYS.tasks);
    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return data.map((item) => Task.fromJSON(item));
    } catch (error) {
        console.error("Failed to load tasks:", error);
        return [];
    }
}

// ========== TIME ENTRIES ==========

export function saveTimeEntries(entries) {
    const data = entries.map((e) => e.toJSON());
    localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data));
}

export function loadTimeEntries() {
    const raw = localStorage.getItem(STORAGE_KEYS.timeEntries);
    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return data.map((item) => TimeEntry.fromJSON(item));
    } catch (error) {
        console.error("Failed to load time entries:", error);
        return [];
    }
}

// ========== ACTIVE TIMER ==========

export function saveActiveTimer(payload) {
    localStorage.setItem(STORAGE_KEYS.activeTimer, JSON.stringify(payload));
}

export function loadActiveTimer() {
    const raw = localStorage.getItem(STORAGE_KEYS.activeTimer);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("Failed to load active timer:", error);
        return null;
    }
}

export function clearActiveTimer() {
    localStorage.removeItem(STORAGE_KEYS.activeTimer);
}

// ========== EXPORT ==========

export function exportAllData() {
    const data = {
        moments: JSON.parse(localStorage.getItem(STORAGE_KEYS.moments) || "[]"),
        tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || "[]"),
        timeEntries: JSON.parse(localStorage.getItem(STORAGE_KEYS.timeEntries) || "[]"),
        exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const timestamp = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `timer-backup-${timestamp}.json`;
    link.click();

    URL.revokeObjectURL(url);
    console.log("Data exported");
}

export async function importAllData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.moments) {
            localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(data.moments));
        }
        if (data.tasks) {
            localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(data.tasks));
        }
        if (data.timeEntries) {
            localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data.timeEntries));
        }

        console.log("Data imported successfully");
        return true;
    } catch (error) {
        console.error("Failed to import data:", error);
        alert("Import failed. Make sure the file is a valid backup.");
        return false;
    }
}

export function clearAllData() {
    if (confirm("Clear all data? This cannot be undone.")) {
        localStorage.removeItem(STORAGE_KEYS.moments);
        localStorage.removeItem(STORAGE_KEYS.tasks);
        localStorage.removeItem(STORAGE_KEYS.timeEntries);
        console.log("All data cleared");
        return true;
    }
    return false;
}
export function updateTimeEntry(id, patch) {
    const raw = localStorage.getItem(STORAGE_KEYS.timeEntries);
    const data = raw ? JSON.parse(raw) : [];

    const index = data.findIndex((e) => e.id === id);
    if (index === -1) return false;

    // Do not allow patch to replace id
    const current = data[index];
    data[index] = {
        ...current,
        ...patch,
        id: current.id,
    };

    localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data));
    return true;
}

export function deleteTimeEntry(id) {
    const raw = localStorage.getItem(STORAGE_KEYS.timeEntries);
    const data = raw ? JSON.parse(raw) : [];

    const next = data.filter((e) => e.id !== id);
    const changed = next.length !== data.length;

    if (changed) {
        localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(next));
    }

    return changed;
}
