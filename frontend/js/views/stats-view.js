// js/views/stats-view.js
export const StatsView = {
    periodFilterEl: () => document.getElementById("stats-period-filter"),
    totalTimeEl: () => document.getElementById("stats-total-time"),
    summaryEl: () => document.getElementById("stats-summary"),
    primeCountEl: () => document.getElementById("stats-prime-count"),
    studyCountEl: () => document.getElementById("stats-study-count"),
    reviewCountEl: () => document.getElementById("stats-review-count"),
    listEl: () => document.getElementById("stats-by-task-list"),
    emptyEl: () => document.getElementById("stats-empty"),
    refreshBtn: () => document.getElementById("stats-refresh-btn"),

    bind({ onRefresh, onPeriodChange } = {}) {
        const refreshBtn = this.refreshBtn();
        const periodFilter = this.periodFilterEl();

        const handleRefresh = () => {
            if (typeof onRefresh === "function") onRefresh();
        };

        const handlePeriodChange = (event) => {
            const button = event.target.closest("[data-period]");
            if (!button) return;

            const period = button.dataset.period;
            if (typeof onPeriodChange === "function") {
                onPeriodChange(period);
            }
        };

        if (refreshBtn) refreshBtn.addEventListener("click", handleRefresh);
        if (periodFilter) periodFilter.addEventListener("click", handlePeriodChange);

        return () => {
            if (refreshBtn) refreshBtn.removeEventListener("click", handleRefresh);
            if (periodFilter) periodFilter.removeEventListener("click", handlePeriodChange);
        };
    },

    render({ period, totalSeconds, entryCount, byTask, primeCount, studyCount, reviewCount }) {
        const totalTimeEl = this.totalTimeEl();
        const summaryEl = this.summaryEl();
        const primeCountEl = this.primeCountEl();
        const studyCountEl = this.studyCountEl();
        const reviewCountEl = this.reviewCountEl();
        const listEl = this.listEl();
        const emptyEl = this.emptyEl();
        const periodFilter = this.periodFilterEl();

        if (!totalTimeEl || !summaryEl || !listEl || !emptyEl) {
            throw new Error("StatsView: missing required DOM elements");
        }

        // Update active period filter
        if (periodFilter) {
            const buttons = periodFilter.querySelectorAll("[data-period]");
            buttons.forEach(btn => {
                if (btn.dataset.period === period) {
                    btn.classList.add("btn--primary");
                    btn.classList.remove("btn--outline");
                } else {
                    btn.classList.remove("btn--primary");
                    btn.classList.add("btn--outline");
                }
            });
        }

        // Update time stats
        totalTimeEl.textContent = this.formatDuration(totalSeconds);
        summaryEl.textContent = `${entryCount} entr${entryCount === 1 ? "y" : "ies"}`;

        // Update study item stats
        if (primeCountEl) primeCountEl.textContent = primeCount?.toString() || '0';
        if (studyCountEl) studyCountEl.textContent = studyCount?.toString() || '0';
        if (reviewCountEl) reviewCountEl.textContent = reviewCount?.toString() || '0';

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
                const duration = this.formatDuration(row.total_seconds);
                const count = row.entry_count;

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
