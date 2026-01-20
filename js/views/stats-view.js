// js/views/stats-view.js
export const StatsView = {
    totalTodayEl: () => document.getElementById("stats-total-today"),
    summaryEl: () => document.getElementById("stats-summary"),
    listEl: () => document.getElementById("stats-by-task-list"),
    emptyEl: () => document.getElementById("stats-empty"),
    refreshBtn: () => document.getElementById("stats-refresh-btn"),

    bind({ onRefresh } = {}) {
        const btn = this.refreshBtn();

        const handleRefresh = () => {
            if (typeof onRefresh === "function") onRefresh();
        };

        if (btn) btn.addEventListener("click", handleRefresh);

        return () => {
            if (btn) btn.removeEventListener("click", handleRefresh);
        };
    },

    render({ totalSeconds, entryCount, byTask }) {
        const totalTodayEl = this.totalTodayEl();
        const summaryEl = this.summaryEl();
        const listEl = this.listEl();
        const emptyEl = this.emptyEl();

        if (!totalTodayEl || !summaryEl || !listEl || !emptyEl) {
            throw new Error("StatsView: missing required DOM elements");
        }

        totalTodayEl.textContent = this.formatDuration(totalSeconds);
        summaryEl.textContent = `${entryCount} entr${entryCount === 1 ? "y" : "ies"} today`;

        if (!byTask.length) {
            listEl.innerHTML = "";
            listEl.style.display = "none";
            emptyEl.style.display = "block";
            return;
        }

        emptyEl.style.display = "none";
        listEl.style.display = "flex";

        listEl.innerHTML = byTask
            .map((row) => {
                const duration = this.formatDuration(row.totalSeconds);
                const count = row.entryCount;

                return `
                    <div class="entry-card">
                        <div class="entry-card__header">
                            <span class="entry-card__title">${row.title}</span>
                            <span class="entry-card__duration">${duration}</span>
                        </div>
                        <div class="entry-card__meta">
                            <span class="entry-card__time">${count} entr${count === 1 ? "y" : "ies"}</span>
                        </div>
                    </div>
                `;
            })
            .join("");
    },

    formatDuration(seconds) {
        const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },
};
