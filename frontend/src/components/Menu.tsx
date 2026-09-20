import { useState } from "react";
import styles from "./Menu.module.css";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Two-step item: the first click swaps the label to this text and arms it;
   * the second click fires onSelect. Blur/Escape/toggle disarm it. */
  confirm?: string;
  /** Hint shown at the top of the panel while the confirm step is armed. */
  confirmNote?: string;
  danger?: boolean;
}

/**
 * The vertical three-dot (⋮) dropdown itself: trigger, panel, and the confirm
 * two-step. What it is a menu *of* is the caller's business — RowMenu names it
 * for a row, PageMenu for the page — so the focus and dismissal behaviour is
 * written once rather than per affordance.
 */
export function Menu({
  triggerLabel,
  items,
  disabled = false,
}: {
  /** The trigger's accessible name; there is no visible text but "⋮". */
  triggerLabel: string;
  items: MenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);

  function close() {
    setOpen(false);
    setConfirming(null);
  }

  function handleSelect(item: MenuItem, index: number) {
    if (item.confirm && confirming !== index) {
      setConfirming(index);
      return;
    }
    close();
    item.onSelect();
  }

  const note = confirming !== null ? items[confirming]?.confirmNote : undefined;

  return (
    <div
      className={styles.menu}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <button
        className={styles.trigger}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        ⋮
      </button>
      {open && (
        <div className={styles.panel}>
          {note && <span className={styles.note}>{note}</span>}
          {items.map((item, index) => (
            <button
              key={item.label}
              className={item.danger ? styles.dangerItem : styles.item}
              type="button"
              onClick={() => handleSelect(item, index)}
            >
              {confirming === index && item.confirm ? item.confirm : item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
