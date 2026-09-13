import type { PeriodStats } from "../../api/types";
import { BarList } from "./BarList";
import { Card } from "./Card";

/** How much was logged, captured and rehearsed in the period. */
export function ActivityCounts({ stats }: { stats: PeriodStats }) {
  const rows = [
    { name: "Entries", value: stats.entry_count },
    { name: "Moments", value: stats.moment_count },
    { name: "Primed", value: stats.prime_count },
    { name: "Studied", value: stats.study_count },
  ];

  return (
    <Card title="Activity">
      <BarList label="Activity" rows={rows.map((row) => ({ ...row, display: String(row.value) }))} />
    </Card>
  );
}
