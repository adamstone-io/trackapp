    // controllers/entries-controller.js
    import { EntriesView } from "../views/list-entries-view.js";
    import { loadTimeEntries, updateTimeEntry, deleteTimeEntry } from "../data/storage.js";
    import { createDropdownMenu } from "../views/components/dropdown-menu.js";
    import { createTimeEntryModal } from "../views/components/time-entry-modal.js";

    export function createEntriesController() {
        const modal = createTimeEntryModal({
            onSave: (payload) => {
                if (payload.id) {
                    updateTimeEntry(payload.id, payload);
                } else {
                    // If you already have a "create manual entry" flow elsewhere, call it here.
                    // Otherwise implement a createTimeEntry(...) helper in storage.
                    console.warn("Create flow not wired in this controller yet:", payload);
                }
                refresh();
            },
        });

        /** @type {Array<Function>} */
        let menuDisposers = [];

        function filterTodayEntries(entries) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            return entries
                .filter((entry) => {
                    const entryDate = new Date(entry.startedAt);
                    return entryDate >= today && entryDate < tomorrow;
                })
                .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        }

        function disposeMenus() {
            for (const dispose of menuDisposers) dispose();
            menuDisposers = [];
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

        function refresh() {
            const entries = loadTimeEntries();
            const todayEntries = filterTodayEntries(entries);

            EntriesView.render(todayEntries);
            attachEntryMenus(todayEntries);
        }

        // initial render
        refresh();

        return {
            refresh,
            dispose: () => {
                disposeMenus();
                modal.dispose();
            },
        };
    }
