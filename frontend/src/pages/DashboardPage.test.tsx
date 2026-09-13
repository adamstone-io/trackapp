import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

beforeEach(() => {
  seedSession();
});

/** A local "YYYY-MM-DD", the form the API uses for a day. */
function isoDay(offset: number): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** "Sat 13 Sep" — how a chart column names its day. */
function dayLabel(offset: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return `${weekdays[day.getDay()]} ${day.getDate()} ${months[day.getMonth()]}`;
}

interface DayOverrides {
  total_seconds?: number;
  entry_count?: number;
}

/** The 14-day series, oldest first, with per-day overrides keyed by offset. */
function series(overrides: Record<number, DayOverrides> = {}, days = 14) {
  return Array.from({ length: days }, (_, index) => {
    const offset = index - (days - 1);
    return {
      date: isoDay(offset),
      total_seconds: 0,
      entry_count: 0,
      ...overrides[offset],
    };
  });
}

function periodStats(overrides: Record<string, unknown> = {}) {
  return {
    period: "today",
    total_seconds: 0,
    entry_count: 0,
    moment_count: 0,
    by_task: [],
    prime_count: 0,
    study_count: 0,
    review_count: 0,
    ...overrides,
  };
}

function habit(overrides: Record<string, unknown> = {}) {
  return {
    id: "habit-1",
    name: "Meditate",
    daily_target: 1,
    weekly_target: 0,
    monthly_target: 0,
    daily_count: 1,
    weekly_count: 3,
    monthly_count: 9,
    is_active: true,
    streak_count: 3,
    last_completed_date: isoDay(0),
    last_logged_at: null,
    recent_completions: [],
    ...overrides,
  };
}

/** A scheduled task planned for today at "HH:MM" local time. */
function planned(title: string, time: string, overrides: Record<string, unknown> = {}) {
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date();
  start.setHours(hours, minutes, 0, 0);
  return {
    id: `task-${title}`,
    title,
    category: "other",
    project: null,
    notes: "",
    archived: false,
    total_seconds: 0,
    entry_count: 0,
    planned_start: start.toISOString(),
    planned_duration: 3600,
    first_started_at: null,
    ...overrides,
  };
}

interface DashboardData {
  days?: object[];
  stats?: object;
  habits?: object[];
  tasks?: object[];
}

/** Stand up the four reads the dashboard makes. */
function seedDashboard({ days, stats, habits = [], tasks = [] }: DashboardData = {}) {
  server.use(
    http.get(api("/tasks/"), () =>
      HttpResponse.json({ count: tasks.length, next: null, previous: null, results: tasks }),
    ),
    http.get(api("/stats/daily/"), () => HttpResponse.json({ days: days ?? series() })),
    http.get(api("/stats/"), ({ request }) => {
      const period = new URL(request.url).searchParams.get("period");
      return HttpResponse.json({ ...periodStats(), ...stats, period });
    }),
    http.get(api("/habits/"), () =>
      HttpResponse.json({ count: habits.length, next: null, previous: null, results: habits }),
    ),
  );
}

describe("today against yesterday", () => {
  it("shows both days' totals side by side with the gap between them", async () => {
    seedDashboard({ days: series({ 0: { total_seconds: 11520 }, [-1]: { total_seconds: 9600 } }) });

    renderApp("/");

    const comparison = await screen.findByRole("region", { name: "Time tracked" });
    expect(within(comparison).getByText("3h 12m")).toBeInTheDocument();
    expect(within(comparison).getByText("2h 40m")).toBeInTheDocument();
    expect(within(comparison).getByText("32m more than yesterday")).toBeInTheDocument();
  });

  it("says so when the day is behind yesterday", async () => {
    seedDashboard({ days: series({ 0: { total_seconds: 600 }, [-1]: { total_seconds: 1800 } }) });

    renderApp("/");

    expect(await screen.findByText("20m less than yesterday")).toBeInTheDocument();
  });

  it("reads level when the two days match", async () => {
    seedDashboard({ days: series({ 0: { total_seconds: 600 }, [-1]: { total_seconds: 600 } }) });

    renderApp("/");

    expect(await screen.findByText("Level with yesterday")).toBeInTheDocument();
  });
});

describe("the fortnight trend", () => {
  it("draws a column per day, each naming its date and what was tracked", async () => {
    seedDashboard({ days: series({ 0: { total_seconds: 3600, entry_count: 2 } }) });

    renderApp("/");

    const trend = await screen.findByRole("list", { name: /last 14 days/i });
    expect(within(trend).getAllByRole("listitem")).toHaveLength(14);
    expect(within(trend).getByTitle(`${dayLabel(0)} — 1h across 2 entries`)).toBeInTheDocument();
    expect(within(trend).getByTitle(`${dayLabel(-13)} — nothing tracked`)).toBeInTheDocument();
  });
});

describe("top tasks", () => {
  const tasks = [
    { title: "Write", total_seconds: 7200, entry_count: 3 },
    { title: "Review", total_seconds: 5400, entry_count: 2 },
    { title: "Email", total_seconds: 3600, entry_count: 4 },
    { title: "Plan", total_seconds: 1800, entry_count: 1 },
    { title: "Read", total_seconds: 900, entry_count: 1 },
    { title: "Tidy", total_seconds: 300, entry_count: 1 },
  ];

  it("charts the five tasks with the most time, longest first", async () => {
    seedDashboard({ stats: { by_task: tasks } });

    renderApp("/");

    const chart = await screen.findByRole("list", { name: "Top tasks" });
    const rows = within(chart).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    ["Write", "Review", "Email", "Plan", "Read"].forEach((name, index) => {
      expect(within(rows[index]).getByText(name)).toBeInTheDocument();
    });
    expect(within(rows[0]).getByText("2h")).toBeInTheDocument();
    expect(within(chart).queryByText("Tidy")).not.toBeInTheDocument();
  });

  it("states the period's total alongside the breakdown", async () => {
    seedDashboard({ stats: { total_seconds: 18900, by_task: tasks } });

    renderApp("/");

    const card = await screen.findByRole("region", { name: "Top tasks" });
    expect(within(card).getByText("5h 15m")).toBeInTheDocument();
  });

  it("says when no time has been tracked in the period", async () => {
    seedDashboard();

    renderApp("/");

    expect(await screen.findByText("No time tracked in this period.")).toBeInTheDocument();
  });
});

describe("activity counts", () => {
  it("charts entries, moments, primes and studies together", async () => {
    seedDashboard({
      stats: { entry_count: 12, moment_count: 3, prime_count: 40, study_count: 7 },
    });

    renderApp("/");

    const chart = await screen.findByRole("list", { name: "Activity" });
    const labelled = (name: string) =>
      within(chart)
        .getAllByRole("listitem")
        .find((row) => within(row).queryByText(name))!;
    expect(within(labelled("Entries")).getByText("12")).toBeInTheDocument();
    expect(within(labelled("Moments")).getByText("3")).toBeInTheDocument();
    expect(within(labelled("Primed")).getByText("40")).toBeInTheDocument();
    expect(within(labelled("Studied")).getByText("7")).toBeInTheDocument();
  });
});

describe("the period selector", () => {
  it("asks the API for the chosen period and redraws the breakdown", async () => {
    const asked: string[] = [];
    seedDashboard();
    server.use(
      http.get(api("/stats/"), ({ request }) => {
        const period = new URL(request.url).searchParams.get("period") ?? "";
        asked.push(period);
        return HttpResponse.json(
          periodStats({
            period,
            by_task:
              period === "this_week" ? [{ title: "Deep work", total_seconds: 7200, entry_count: 2 }] : [],
          }),
        );
      }),
    );

    renderApp("/");

    expect(await screen.findByText("No time tracked in this period.")).toBeInTheDocument();
    expect(asked).toContain("today");

    await userEvent.click(screen.getByRole("button", { name: "This week" }));

    expect(await screen.findByText("Deep work")).toBeInTheDocument();
    expect(asked).toContain("this_week");
    expect(screen.getByRole("button", { name: "This week" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("habit chains", () => {
  it("counts the run of days carried up to today", async () => {
    seedDashboard({
      habits: [habit({ recent_completions: [isoDay(-2), isoDay(-1), isoDay(0)] })],
    });

    renderApp("/");

    const chains = await screen.findByRole("list", { name: "Habit chains" });
    const row = within(chains).getByRole("listitem");
    expect(within(row).getByText("Meditate")).toBeInTheDocument();
    expect(within(row).getByText("3 day chain")).toBeInTheDocument();
  });

  it("keeps the chain alive on a day not yet carried", async () => {
    seedDashboard({ habits: [habit({ recent_completions: [isoDay(-2), isoDay(-1)] })] });

    renderApp("/");

    expect(await screen.findByText("2 day chain")).toBeInTheDocument();
  });

  it("breaks the chain when a day was skipped", async () => {
    seedDashboard({
      habits: [habit({ recent_completions: [isoDay(-5), isoDay(-4), isoDay(-2)] })],
    });

    renderApp("/");

    expect(await screen.findByText("Chain broken")).toBeInTheDocument();
  });

  it("describes the whole strip for a screen reader", async () => {
    seedDashboard({
      habits: [habit({ recent_completions: [isoDay(-1), isoDay(0)] })],
    });

    renderApp("/");

    expect(
      await screen.findByRole("img", { name: "Meditate: carried on 2 of the last 28 days" }),
    ).toBeInTheDocument();
  });

  it("shows the counters the habit is aimed at, and no others", async () => {
    seedDashboard({
      habits: [habit({ daily_target: 3, daily_count: 2, weekly_target: 10, weekly_count: 5 })],
    });

    renderApp("/");

    const chains = await screen.findByRole("list", { name: "Habit chains" });
    const row = within(chains).getByRole("listitem");
    expect(within(row).getByText("2/3")).toBeInTheDocument();
    expect(within(row).getByText("5/10")).toBeInTheDocument();
    expect(within(row).queryByText("9/0")).not.toBeInTheDocument();
  });

  it("leaves archived habits out of the chains", async () => {
    seedDashboard({
      habits: [habit(), habit({ id: "habit-2", name: "Stretch", is_active: false })],
    });

    renderApp("/");

    const chains = await screen.findByRole("list", { name: "Habit chains" });
    expect(within(chains).queryByText("Stretch")).not.toBeInTheDocument();
  });

  it("says when there are no habits to chain", async () => {
    seedDashboard();

    renderApp("/");

    expect(await screen.findByText("No habits to chain yet.")).toBeInTheDocument();
  });
});

describe("today's plan", () => {
  it("lists the day's scheduled tasks, earliest first", async () => {
    seedDashboard({ tasks: [planned("Write", "14:00"), planned("Stand-up", "09:30")] });

    renderApp("/");

    const plan = await screen.findByRole("list", { name: "Today's plan" });
    const rows = within(plan).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("09:30")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Stand-up")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Write")).toBeInTheDocument();
  });

  it("says when the day has nothing scheduled", async () => {
    seedDashboard();

    renderApp("/");

    expect(await screen.findByText("Nothing scheduled today.")).toBeInTheDocument();
  });

  it("leaves archived tasks off the plan", async () => {
    seedDashboard({ tasks: [planned("Cancelled", "10:00", { archived: true })] });

    renderApp("/");

    expect(await screen.findByText("Nothing scheduled today.")).toBeInTheDocument();
  });
});
