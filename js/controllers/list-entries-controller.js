// controllers/list-entries-controller.js
import { EntriesView } from "../views/list-entries-view.js";
import { loadTimeEntries, loadMoments, updateTimeEntry, deleteTimeEntry, deleteMoment } from "../data/storage.js";
import { createDropdownMenu } from "../views/components/dropdown-menu.js";
import { createTimeEntryModal } from "../views/components/time-entry-modal.js";

export function createEntriesController() {
    const modal = createTimeEntryModal({
        onSave: (payload) => {
            if (payload.id) {
                const durationSeconds = Math.round(
                    (new Date(payload.endedAt) - new Date(payload.startedAt)) / 1000
                );

                updateTimeEntry(payload.id, {
                    taskTitle: payload.taskTitle,
                    startedAt: payload.startedAt,
                    endedAt: payload.endedAt,
                    durationSeconds,
                });
            } else {
                // Create is handled by your manual-entry flow; keep this explicit.
                console.warn("Create flow not wired in this controller yet:", payload);
            }

            refresh();
        },
    });

    /** @type {Array<Function>} */
    let menuDisposers = [];
    /** @type {Array<Function>} */
    let momentMenuDisposers = [];
    /** @type {Function | null} */
    let onEditMoment = null;

    function getTodayWindowMs() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        return { startMs: start.getTime(), endMs: end.getTime() };
    }

    function disposeMenus() {
        for (const dispose of menuDisposers) dispose();
        menuDisposers = [];
    }

    function disposeMomentMenus() {
        for (const dispose of momentMenuDisposers) dispose();
        momentMenuDisposers = [];
    }

    function attachEntryMenus(entries) {
        disposeMenus();

        const listEl = EntriesView.list();
        const buttons = listEl.querySelectorAll("[data-entry-menu]");

        buttons.forEach((btn) => {
            const card = btn.closest("[data-entry-id]");
            if (!card) return;

            const entryId = card.getAttribute("data-entry-id");
            const entry = entries.find((e) => e.id === entryId);
            if (!entry) return;

            const menu = createDropdownMenu({
                items: [
                    {
                        label: "Edit",
                        onSelect: () => modal.openEdit(entry),
                    },
                    {
                        label: "Delete",
                        onSelect: () => {
                            deleteTimeEntry(entry.id);
                            refresh();
                        },
                    },
                ],
            });

            menu.attachTo(btn);
            menuDisposers.push(() => menu.dispose());
        });
    }

    function attachMomentMenus(moments) {
        disposeMomentMenus();

        const listEl = EntriesView.list();
        const buttons = listEl.querySelectorAll("[data-moment-menu]");

        buttons.forEach((btn) => {
            const card = btn.closest("[data-moment-id]");
            if (!card) return;

            const momentId = card.getAttribute("data-moment-id");
            const moment = moments.find((m) => m.id === momentId);
            if (!moment) return;

            const menu = createDropdownMenu({
                items: [
                    {
                        label: "Edit",
                        onSelect: () => {
                            if (typeof onEditMoment === "function") {
                                onEditMoment(moment);
                            }
                        },
                    },
                    {
                        label: "Delete",
                        onSelect: () => {
                            deleteMoment(moment.id);
                            refresh();
                        },
                    },
                ],
            });

            menu.attachTo(btn);
            momentMenuDisposers.push(() => menu.dispose());
        });
    }

    function refresh() {
        const { startMs, endMs } = getTodayWindowMs();

        const todayEntries = loadTimeEntries()
            .filter((entry) => {
                const ms = new Date(entry.startedAt).getTime();
                return ms >= startMs && ms < endMs;
            });

        const todayMoments = loadMoments()
            .filter((moment) => moment.timestampMs >= startMs && moment.timestampMs < endMs);

        const items = [
            ...todayEntries.map((entry) => ({
                kind: "entry",
                atMs: new Date(entry.startedAt).getTime(),
                entry,
            })),
            ...todayMoments.map((moment) => ({
                kind: "moment",
                atMs: moment.timestampMs,
                moment,
            })),
        ].sort((a, b) => {
            if (b.atMs !== a.atMs) return b.atMs - a.atMs;
            // Tie-breaker: show moments before entries if same timestamp
            if (a.kind !== b.kind) return a.kind === "moment" ? -1 : 1;
            return 0;
        });

        EntriesView.render(items);

        // Menus only exist for entries
        attachEntryMenus(todayEntries);
        attachMomentMenus(todayMoments);
    }

    refresh();

    return {
        refresh,
        setMomentEditor: (handler) => {
            onEditMoment = typeof handler === "function" ? handler : null;
        },
        dispose: () => {
            disposeMenus();
            disposeMomentMenus();
            modal.dispose();
        },
    };
}
