import { Menu, type MenuItem } from "./Menu";

export type { MenuItem as RowMenuItem };

/**
 * Vertical three-dot (⋮) dropdown of row actions — the shared affordance for
 * every list row's secondary actions (timer log, workspace, habits, …).
 */
export function RowMenu({
  name,
  items,
  disabled = false,
}: {
  /** Row identity for the trigger's accessible name ("More {name}"). */
  name: string;
  items: MenuItem[];
  disabled?: boolean;
}) {
  return <Menu triggerLabel={`More ${name}`} items={items} disabled={disabled} />;
}
