import { Menu, type MenuItem } from "./Menu";

/**
 * The page's own ⋮, at the top of the content. It holds what belongs to the
 * whole page rather than to any one row — the way into the archive, first of
 * all, which is somewhere to go looking rather than a list to scroll past.
 */
export function PageMenu({ items }: { items: MenuItem[] }) {
  return <Menu triggerLabel="Page actions" items={items} />;
}
