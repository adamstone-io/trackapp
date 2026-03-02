import { API_BASE } from "./config.js";
import { http } from "./http.js";

const BASE = `${API_BASE}/stats`;

/**
 * Load stats for a specific time period
 * @param {Object} options - Options for loading stats
 * @param {string} options.period - Time period: 'today', 'yesterday', 'this_week', 'this_month'
 * @returns {Promise<Object>} Stats data including total_seconds, entry_count, and by_task breakdown
 */
export async function loadStats({ period = "today" } = {}) {
  // Get user's IANA timezone (e.g., 'Australia/Brisbane')
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const params = new URLSearchParams();
  params.set("period", period);

  const query = params.toString() ? `?${params.toString()}` : "";

  return http(`${BASE}/${query}`, {
    headers: {
      "X-User-Timezone": userTimezone,
    },
  });
}
