import type { Habit } from "../../api/types";
import { formatWeekdayDayMonth, parseIsoDay, toIsoDay } from "../../lib/time";
import { Card } from "./Card";
import styles from "./dashboard.module.css";

const CHAIN_DAYS = 28;

/** "Don't break the chain": every habit's recent days, linked where the
 * habit was carried and broken wherever a day was skipped. */
export function HabitChains({ habits }: { habits: Habit[] }) {
  const active = habits.filter((habit) => habit.is_active);
  const days = recentDays(CHAIN_DAYS);

  return (
    <Card title="Habit streaks">
      {active.length === 0 ? (
        <p className={styles.empty}>No habits yet.</p>
      ) : (
        <ul className={styles.chains} aria-label="Habit streaks">
          {active.map((habit) => (
            <ChainRow key={habit.id} habit={habit} days={days} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChainRow({ habit, days }: { habit: Habit; days: string[] }) {
  const carried = new Set(habit.recent_completions);
  const strip = days.map((day) => ({ day, done: carried.has(day) }));
  const carriedDays = strip.filter((link) => link.done).length;
  const chain = chainLength(carried, days[days.length - 1]);

  return (
    <li className={styles.chainRow}>
      <div className={styles.chainHead}>
        <span className={styles.chainName}>{habit.name}</span>
        <span className={styles.chainMeta}>
          {/* Only the counters the habit is aimed at, as on the habits page. */}
          {habit.daily_target > 0 && (
            <span className={styles.chainCount}>
              {habit.daily_count}/{habit.daily_target}
            </span>
          )}
          {habit.weekly_target > 0 && (
            <span className={styles.chainCount}>
              {habit.weekly_count}/{habit.weekly_target}
            </span>
          )}
          <span className={chain > 0 ? styles.chainLength : styles.chainBroken}>
            {chain > 0 ? `${chain} day streak` : "Streak broken"}
          </span>
        </span>
      </div>
      <div
        className={chain > 0 ? `${styles.chainStrip} ${styles.live}` : styles.chainStrip}
        role="img"
        aria-label={`${habit.name}: carried on ${carriedDays} of the last ${days.length} days`}
      >
        {strip.map((link, index) => (
          <span
            key={link.day}
            className={linkClass(link.done, index > 0 && strip[index - 1].done)}
            title={`${formatWeekdayDayMonth(link.day)} — ${link.done ? "carried" : "missed"}`}
          >
            <span className={styles.chainDot} />
          </span>
        ))}
      </div>
    </li>
  );
}

function linkClass(done: boolean, linkedToPrevious: boolean): string {
  const classes = [styles.chainDay];
  if (done) classes.push(styles.chainDone);
  if (done && linkedToPrevious) classes.push(styles.chainLinked);
  return classes.join(" ");
}

/** The last `count` local days, oldest first, ending today. */
function recentDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (count - 1 - index));
    return toIsoDay(day);
  });
}

/** The unbroken run of carried days ending at today — or at yesterday, since
 * a day still in progress hasn't broken anything yet. */
function chainLength(carried: Set<string>, today: string): number {
  const cursor = parseIsoDay(today);
  if (!carried.has(today)) cursor.setDate(cursor.getDate() - 1);

  let length = 0;
  while (carried.has(toIsoDay(cursor))) {
    length += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return length;
}
