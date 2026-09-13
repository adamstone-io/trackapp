import { Card } from "./Card";
import { Column } from "./Column";
import { usePeriodStatsQuery } from "./useStats";
import styles from "./dashboard.module.css";

/**
 * Today's priming and studying, beside today's tracked time. Pinned to today
 * whatever the period selector says — it belongs to the day-scoped band at the
 * top of the page. When the selector is on Today this shares its query.
 */
export function StudyCounts() {
  const { data: stats } = usePeriodStatsQuery("today");
  if (!stats) return null;

  const tallest = Math.max(stats.prime_count, stats.study_count, 1);

  return (
    <Card title="Study today">
      <div className={styles.compare}>
        <Column
          label="Primed"
          value={stats.prime_count}
          display={String(stats.prime_count)}
          tallest={tallest}
          highlight
        />
        <Column
          label="Studied"
          value={stats.study_count}
          display={String(stats.study_count)}
          tallest={tallest}
          highlight
        />
      </div>
    </Card>
  );
}
