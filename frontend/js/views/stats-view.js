// js/views/stats-view.js
export const StatsView = {
    totalTodayEl: () => document.getElementById("stats-total-today"),
    summaryEl: () => document.getElementById("stats-summary"),
    primesTodayEl: () => document.getElementById("stats-primes-today"),
    primesTodaySummaryEl: () => document.getElementById("stats-primes-today-summary"),
    primesYesterdayEl: () => document.getElementById("stats-primes-yesterday"),
    primesYesterdaySummaryEl: () => document.getElementById("stats-primes-yesterday-summary"),
    primesWeekEl: () => document.getElementById("stats-primes-week"),
    primesWeekSummaryEl: () => document.getElementById("stats-primes-week-summary"),
    primesLastWeekEl: () => document.getElementById("stats-primes-last-week"),
    primesLastWeekSummaryEl: () => document.getElementById("stats-primes-last-week-summary"),
    reviewsTodayEl: () => document.getElementById("stats-reviews-today"),
    reviewsTodaySummaryEl: () => document.getElementById("stats-reviews-today-summary"),
    reviewsWeekEl: () => document.getElementById("stats-reviews-week"),
    reviewsWeekSummaryEl: () => document.getElementById("stats-reviews-week-summary"),
    reviewsMonthEl: () => document.getElementById("stats-reviews-month"),
    reviewsMonthSummaryEl: () => document.getElementById("stats-reviews-month-summary"),
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

    render({ totalSeconds, entryCount, byTask, todayPrimes, yesterdayPrimes, weekPrimes, lastWeekPrimes, totalPrimes, todayReviews, weekReviews, monthReviews, totalReviews }) {
        const totalTodayEl = this.totalTodayEl();
        const summaryEl = this.summaryEl();
        const primesTodayEl = this.primesTodayEl();
        const primesTodaySummaryEl = this.primesTodaySummaryEl();
        const primesYesterdayEl = this.primesYesterdayEl();
        const primesYesterdaySummaryEl = this.primesYesterdaySummaryEl();
        const primesWeekEl = this.primesWeekEl();
        const primesWeekSummaryEl = this.primesWeekSummaryEl();
        const primesLastWeekEl = this.primesLastWeekEl();
        const primesLastWeekSummaryEl = this.primesLastWeekSummaryEl();
        const reviewsTodayEl = this.reviewsTodayEl();
        const reviewsTodaySummaryEl = this.reviewsTodaySummaryEl();
        const reviewsWeekEl = this.reviewsWeekEl();
        const reviewsWeekSummaryEl = this.reviewsWeekSummaryEl();
        const reviewsMonthEl = this.reviewsMonthEl();
        const reviewsMonthSummaryEl = this.reviewsMonthSummaryEl();
        const listEl = this.listEl();
        const emptyEl = this.emptyEl();

        if (!totalTodayEl || !summaryEl || !primesTodayEl || !primesTodaySummaryEl || !primesYesterdayEl || !primesYesterdaySummaryEl || !primesWeekEl || !primesWeekSummaryEl || !primesLastWeekEl || !primesLastWeekSummaryEl || !listEl || !emptyEl) {
            throw new Error("StatsView: missing required DOM elements");
        }

        // Update time stats
        totalTodayEl.textContent = this.formatDuration(totalSeconds);
        summaryEl.textContent = `${entryCount} entr${entryCount === 1 ? "y" : "ies"}`;

        // Update primes stats
        primesTodayEl.textContent = todayPrimes.toString();
        primesTodaySummaryEl.textContent = '';
        
        primesYesterdayEl.textContent = yesterdayPrimes.toString();
        primesYesterdaySummaryEl.textContent = '';
        
        primesWeekEl.textContent = weekPrimes.toString();
        primesWeekSummaryEl.textContent = '';
        
        primesLastWeekEl.textContent = lastWeekPrimes.toString();
        primesLastWeekSummaryEl.textContent = '';

        // Update reviews stats
        if (reviewsTodayEl) {
            reviewsTodayEl.textContent = todayReviews?.toString() || '0';
            if (reviewsTodaySummaryEl) reviewsTodaySummaryEl.textContent = '';
        }
        
        if (reviewsWeekEl) {
            reviewsWeekEl.textContent = weekReviews?.toString() || '0';
            if (reviewsWeekSummaryEl) reviewsWeekSummaryEl.textContent = '';
        }
        
        if (reviewsMonthEl) {
            reviewsMonthEl.textContent = monthReviews?.toString() || '0';
            if (reviewsMonthSummaryEl) reviewsMonthSummaryEl.textContent = '';
        }

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
