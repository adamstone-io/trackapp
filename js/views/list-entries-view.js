    // views/entries-view.js
    import { byId } from "../ui/ui-core.js";

    export const EntriesView = {
        list: () => byId("entries-list"),
        empty: () => byId("entries-empty"),

        render(entries) {
            const list = this.list();
            const empty = this.empty();

            if (entries.length === 0) {
                list.style.display = "none";
                empty.style.display = "block";
                return;
            }

            list.style.display = "block";
            empty.style.display = "none";

            list.innerHTML = entries
                .map((entry) => this.renderEntry(entry))
                .join("");
        },

        renderEntry(entry) {
            const duration = this.formatDuration(entry.durationSeconds);
            const timeRange = this.formatTimeRange(entry.startedAt, entry.endedAt);

            return `
                    <div class="entry-card" data-entry-id="${entry.id}">
        <div class="entry-card__header">
            <span class="entry-card__title">${entry.taskTitle || "Untitled Task"}</span>
            <span class="entry-card__duration">${duration}</span>
        </div>

        <div class="entry-card__meta">
            <span class="entry-card__time">${timeRange}</span>

            <button
                class="icon-btn entry-card__menu-btn"
                aria-label="Time Entry options"
                type="button"
                data-entry-menu
            >
                <svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="2" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="8" cy="14" r="1.5" />
                </svg>
            </button>
        </div>
    </div>
            `;
        },

        formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);

            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        },

        formatTimeRange(startedAt, endedAt) {
            const start = new Date(startedAt);
            const end = new Date(endedAt);

            const formatTime = (date) => {
                return date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                });
            };

            return `${formatTime(start)} - ${formatTime(end)}`;
        },
    };
