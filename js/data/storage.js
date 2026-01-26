import { Moment } from "../domain/moment.js";
import { TimeEntry } from "../domain/time-entry.js";
import { Task } from "../domain/task.js";
import { PrimeItem } from "../domain/prime-item.js";
import { ReviewItem } from "../domain/review-item.js";

const STORAGE_KEYS = {
    moments: "moments",
    timeEntries: "timeEntries",
    tasks: "tasks",
    activeTimer: "activeTimer",
    primeItems: "primeItems",
    reviewItems: "reviewItems",
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

export function deleteMoment(id) {
    const raw = localStorage.getItem(STORAGE_KEYS.moments);
    const data = raw ? JSON.parse(raw) : [];

    const next = data.filter((m) => m.id !== id);
    const changed = next.length !== data.length;

    if (changed) {
        localStorage.setItem(STORAGE_KEYS.moments, JSON.stringify(next));
    }

    return changed;
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

// ========== PRIME ITEMS ==========

export function savePrimeItems(primeItems) {
    const data = primeItems.map((p) => p.toJSON());
    localStorage.setItem(STORAGE_KEYS.primeItems, JSON.stringify(data));
}

export function loadPrimeItems() {
    const raw = localStorage.getItem(STORAGE_KEYS.primeItems);
    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return data.map((item) => PrimeItem.fromJSON(item));
    } catch (error) {
        console.error("Failed to load prime items:", error);
        return [];
    }
}

export function updatePrimeItem(id, patch) {
    const raw = localStorage.getItem(STORAGE_KEYS.primeItems);
    const data = raw ? JSON.parse(raw) : [];

    const index = data.findIndex((p) => p.id === id);
    if (index === -1) return false;

    const current = data[index];
    data[index] = {
        ...current,
        ...patch,
        id: current.id,
    };

    localStorage.setItem(STORAGE_KEYS.primeItems, JSON.stringify(data));
    return true;
}

export function deletePrimeItem(id) {
    const raw = localStorage.getItem(STORAGE_KEYS.primeItems);
    const data = raw ? JSON.parse(raw) : [];

    const next = data.filter((p) => p.id !== id);
    const changed = next.length !== data.length;

    if (changed) {
        localStorage.setItem(STORAGE_KEYS.primeItems, JSON.stringify(next));
    }

    return changed;
}

// ========== REVIEW ITEMS ==========

export function saveReviewItems(reviewItems) {
    const data = reviewItems.map((r) => r.toJSON ? r.toJSON() : r);
    localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(data));
}

export function loadReviewItems() {
    const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return data.map((item) => ReviewItem.fromJSON(item));
    } catch (error) {
        console.error("Failed to load review items:", error);
        return [];
    }
}

export function updateReviewItem(id, patch) {
    const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
    const data = raw ? JSON.parse(raw) : [];

    const index = data.findIndex((r) => r.id === id);
    if (index === -1) return false;

    const current = data[index];
    data[index] = {
        ...current,
        ...patch,
        id: current.id,
    };

    localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(data));
    return true;
}

export function deleteReviewItem(id) {
    const raw = localStorage.getItem(STORAGE_KEYS.reviewItems);
    const data = raw ? JSON.parse(raw) : [];

    const next = data.filter((r) => r.id !== id);
    const changed = next.length !== data.length;

    if (changed) {
        localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(next));
    }

    return changed;
}

// ========== CONVERSION UTILITIES ==========

/**
 * Convert a prime item to a review item.
 * Creates a new review item and archives the original prime item.
 * @param {string} primeItemId - ID of the prime item to convert
 * @returns {Object|null} - The created review item or null if failed
 */
export function convertPrimeToReview(primeItemId) {
    // Load prime items
    const primeRaw = localStorage.getItem(STORAGE_KEYS.primeItems);
    const primeData = primeRaw ? JSON.parse(primeRaw) : [];
    
    // Find the prime item
    const primeItem = primeData.find(p => p.id === primeItemId);
    if (!primeItem) return null;
    
    // Create new review item with data from prime item
    const reviewItem = {
        id: crypto.randomUUID(),
        title: primeItem.title,
        description: primeItem.description || "",
        category: primeItem.category || "",
        reviewTimestamps: [...(primeItem.primeTimestamps || [])], // Transfer timestamps
        firstStudiedAt: primeItem.primeTimestamps && primeItem.primeTimestamps.length > 0 
            ? Math.min(...primeItem.primeTimestamps) 
            : null,
        archived: false,
        createdAt: new Date().toISOString(),
    };
    
    // Add to review items
    const reviewRaw = localStorage.getItem(STORAGE_KEYS.reviewItems);
    const reviewData = reviewRaw ? JSON.parse(reviewRaw) : [];
    reviewData.push(reviewItem);
    localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(reviewData));
    
    // Archive the original prime item
    const primeIndex = primeData.findIndex(p => p.id === primeItemId);
    if (primeIndex !== -1) {
        primeData[primeIndex].archived = true;
        localStorage.setItem(STORAGE_KEYS.primeItems, JSON.stringify(primeData));
    }
    
    return reviewItem;
}

// ========== EXPORT ==========

export function exportAllData() {
    const data = {
        moments: JSON.parse(localStorage.getItem(STORAGE_KEYS.moments) || "[]"),
        tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || "[]"),
        timeEntries: JSON.parse(localStorage.getItem(STORAGE_KEYS.timeEntries) || "[]"),
        primeItems: JSON.parse(localStorage.getItem(STORAGE_KEYS.primeItems) || "[]"),
        reviewItems: JSON.parse(localStorage.getItem(STORAGE_KEYS.reviewItems) || "[]"),
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
        if (data.primeItems) {
            localStorage.setItem(STORAGE_KEYS.primeItems, JSON.stringify(data.primeItems));
        }
        if (data.reviewItems) {
            localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify(data.reviewItems));
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
        localStorage.removeItem(STORAGE_KEYS.primeItems);
        localStorage.removeItem(STORAGE_KEYS.reviewItems);
        console.log("All data cleared");
        return true;
    }
    return false;
}
