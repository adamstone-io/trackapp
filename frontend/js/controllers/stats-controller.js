// js/controllers/stats-controller.js
import { loadStats } from "../api/statsApi.js";
import { StatsView } from "../views/stats-view.js";

export function createStatsController() {
  let currentPeriod = "today";

  const unbind = StatsView.bind({
    onRefresh: refresh,
    onPeriodChange: (period) => {
      currentPeriod = period;
      refresh();
    },
  });

  async function refresh() {
    try {
      const data = await loadStats({ period: currentPeriod });

      StatsView.render({
        period: currentPeriod,
        totalSeconds: data.total_seconds || 0,
        entryCount: data.entry_count || 0,
        byTask: data.by_task || [],
        primeCount: data.prime_count || 0,
        studyCount: data.study_count || 0,
        reviewCount: data.review_count || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      // Show empty state on error
      StatsView.render({
        period: currentPeriod,
        totalSeconds: 0,
        entryCount: 0,
        byTask: [],
        primeCount: 0,
        studyCount: 0,
        reviewCount: 0,
      });
    }
  }

  refresh();

  return {
    refresh,
    dispose: () => {
      unbind();
    },
  };
}
