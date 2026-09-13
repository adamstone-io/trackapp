import { Card } from "./Card";
import { Column } from "./Column";
import { usePeriodStatsQuery } from "./useStats";
import styles from "./dashboard.module.css";

/**
 * Priming and studying, today against yesterday, beside today's tracked time.
 * Pinned to those two days whatever the period selector says — this belongs to
 * the day-scoped band at the top of the page. When the selector is on Today or
 * Yesterday it shares that query rather than making a second one.
 */
export function StudyCounts() {
  const { data: today } = usePeriodStatsQuery("today");
  const { data: yesterday } = usePeriodStatsQuery("yesterday");
  if (!today || !yesterday) return null;

  // All four are counts of the same kind of thing, so one scale spans them
  // and priming is comparable with studying, not just with its own day.
  const tallest = Math.max(
    today.prime_count,
    yesterday.prime_count,
    today.study_count,
    yesterday.study_count,
    1,
  );

  return (
    <Card title="Study">
      <div className={styles.groups}>
        <Pair
          caption="Primed"
          today={today.prime_count}
          yesterday={yesterday.prime_count}
          tallest={tallest}
        />
        <Pair
          caption="Studied"
          today={today.study_count}
          yesterday={yesterday.study_count}
          tallest={tallest}
        />
      </div>
    </Card>
  );
}

function Pair({
  caption,
  today,
  yesterday,
  tallest,
}: {
  caption: string;
  today: number;
  yesterday: number;
  tallest: number;
}) {
  return (
    <div className={styles.group}>
      <div className={styles.compare}>
        <Column
          label="Today"
          value={today}
          display={String(today)}
          tallest={tallest}
          highlight
        />
        <Column
          label="Yesterday"
          value={yesterday}
          display={String(yesterday)}
          tallest={tallest}
        />
      </div>
      <p className={styles.groupCaption}>{caption}</p>
    </div>
  );
}
