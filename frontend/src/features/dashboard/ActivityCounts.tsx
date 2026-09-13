import type { PeriodStats } from "../../api/types";
import { BarList } from "./BarList";
import { Card } from "./Card";

/** How much was logged and captured in the period. Priming and studying have
 * their own card at the top of the page, pinned to today. */
export function ActivityCounts({ stats }: { stats: PeriodStats }) {
  const rows = [
    { name: "Entries", value: stats.entry_count },
    { name: "Moments", value: stats.moment_count },
  ];

  return (
    <Card title="Activity">
      <BarList label="Activity" rows={rows.map((row) => ({ ...row, display: String(row.value) }))} />
    </Card>
  );
}
