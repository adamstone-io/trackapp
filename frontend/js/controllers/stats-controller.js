// js/controllers/stats-controller.js
import { loadTimeEntries, loadPrimeItems, loadReviewItems } from "../data/storage.js";
import { StatsView } from "../views/stats-view.js";

export function createStatsController() {
    const unbind = StatsView.bind({
        onRefresh: refresh,
    });

    function getTodayWindowMs() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        return { startMs: start.getTime(), endMs: end.getTime() };
    }

    function normalizeTitle(title) {
        return (title ?? "").trim().toLowerCase();
    }

    function computeDurationSeconds(entry) {
        if (Number.isFinite(entry.durationSeconds)) return entry.durationSeconds;

        if (entry.startedAt && entry.endedAt) {
            const start = new Date(entry.startedAt).getTime();
            const end = new Date(entry.endedAt).getTime();
            const diff = Math.round((end - start) / 1000);
            return Number.isFinite(diff) && diff > 0 ? diff : 0;
        }

        return 0;
    }

    function refresh() {
        const { startMs, endMs } = getTodayWindowMs();

        const entries = loadTimeEntries()
            .filter((entry) => {
                const ms = new Date(entry.startedAt).getTime();
                return ms >= startMs && ms < endMs;
            });

        let totalSeconds = 0;

        /** @type {Map<string, { title: string, totalSeconds: number, entryCount: number }>} */
        const groups = new Map();

        for (const entry of entries) {
            const durationSeconds = computeDurationSeconds(entry);
            if (!durationSeconds) continue;

            totalSeconds += durationSeconds;

            const rawTitle = (entry.taskTitle ?? "Untitled Task").trim() || "Untitled Task";
            const key = normalizeTitle(rawTitle) || "untitled task";

            const existing = groups.get(key);
            if (!existing) {
                groups.set(key, {
                    title: rawTitle,
                    totalSeconds: durationSeconds,
                    entryCount: 1,
                });
            } else {
                existing.totalSeconds += durationSeconds;
                existing.entryCount += 1;
            }
        }

        const byTask = Array.from(groups.values())
            .sort((a, b) => b.totalSeconds - a.totalSeconds);

        // Calculate prime item statistics
        const primeItems = loadPrimeItems();
        let totalPrimes = 0;
        let todayPrimes = 0;
        let yesterdayPrimes = 0;
        let weekPrimes = 0;
        let lastWeekPrimes = 0;

        for (const item of primeItems) {
            const total = item.getTotalCount();
            const today = item.getTodayCount();
            const yesterday = item.getYesterdayCount();
            const week = item.getThisWeekCount();
            const lastWeek = item.getLastWeekCount();
            
            totalPrimes += total;
            todayPrimes += today;
            yesterdayPrimes += yesterday;
            weekPrimes += week;
            lastWeekPrimes += lastWeek;
        }

        // Calculate review item statistics
        const reviewItems = loadReviewItems();
        let totalReviews = 0;
        let todayReviews = 0;
        let weekReviews = 0;
        let monthReviews = 0;

        for (const item of reviewItems) {
            const total = item.getTotalCount();
            const today = item.getTodayCount();
            const week = item.getThisWeekCount();
            const month = item.getThisMonthCount();
            
            totalReviews += total;
            todayReviews += today;
            weekReviews += week;
            monthReviews += month;
        }

        StatsView.render({
            totalSeconds,
            entryCount: entries.length,
            byTask,
            totalPrimes,
            todayPrimes,
            yesterdayPrimes,
            weekPrimes,
            lastWeekPrimes,
            totalReviews,
            todayReviews,
            weekReviews,
            monthReviews,
        });
    }

    refresh();

    return {
        refresh,
        dispose: () => {
            unbind();
        },
    };
}
