import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

beforeEach(() => {
  seedSession();
});

/** Backend shape: GET /api/habits/ is paginated. */
function habitsPage(habits: object[], next: string | null = null) {
  return { count: habits.length, next, previous: null, results: habits };
}

function habit(overrides: Record<string, unknown> = {}) {
  return {
    id: "habit-1",
    name: "Meditate",
    daily_target: 3,
    weekly_target: 10,
    monthly_target: 40,
    daily_count: 2,
    weekly_count: 5,
    monthly_count: 20,
    is_active: true,
    streak_count: 4,
    last_completed_date: "2026-09-12",
    last_logged_at: "2026-09-12T21:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function card(name: string): HTMLElement {
  return screen.getByText(name).closest("li")!;
}

describe("habits list", () => {
  it("shows each active habit with its counts against targets and its streak", async () => {
    server.use(
      http.get(api("/habits/"), () =>
        HttpResponse.json(
          habitsPage([
            habit(),
            habit({ id: "habit-2", name: "Read", daily_count: 0, streak_count: 0 }),
          ]),
        ),
      ),
    );

    renderApp("/habits");

    expect(await screen.findByText("Meditate")).toBeInTheDocument();
    const meditate = card("Meditate");
    expect(within(meditate).getByText("2/3")).toBeInTheDocument();
    expect(within(meditate).getByText("5/10")).toBeInTheDocument();
    expect(within(meditate).getByText("20/40")).toBeInTheDocument();
    expect(within(meditate).getByText(/4 day/)).toBeInTheDocument();

    // A habit with no streak shows no streak text.
    expect(within(card("Read")).queryByText(/day/)).not.toBeInTheDocument();
  });
});

describe("creating a habit", () => {
  it("posts the name and all three targets and shows the new habit", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([]))),
      http.post(api("/habits/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          habit({ id: "habit-new", name: "Stretch", daily_count: 0, streak_count: 0, ...posted }),
          { status: 201 },
        );
      }),
    );

    renderApp("/habits");

    await user.click(await screen.findByRole("button", { name: /add habit/i }));
    await user.type(screen.getByLabelText(/name/i), "Stretch");
    await user.type(screen.getByLabelText(/daily target/i), "2");
    await user.type(screen.getByLabelText(/weekly target/i), "8");
    await user.type(screen.getByLabelText(/monthly target/i), "30");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Stretch")).toBeInTheDocument();
    expect(posted).toMatchObject({
      name: "Stretch",
      daily_target: 2,
      weekly_target: 8,
      monthly_target: 30,
    });
  });
});

describe("logging progress", () => {
  it("increments all three counters immediately, then shows the server's streak", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.post(api("/habits/habit-1/log/"), async () => {
        await gate;
        return HttpResponse.json(
          habit({ daily_count: 3, weekly_count: 6, monthly_count: 21, streak_count: 5 }),
        );
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /log meditate/i }));

    // The server hasn't answered yet — counters already moved.
    const meditate = card("Meditate");
    expect(within(meditate).getByText("3/3")).toBeInTheDocument();
    expect(within(meditate).getByText("6/10")).toBeInTheDocument();
    expect(within(meditate).getByText("21/40")).toBeInTheDocument();

    release();
    expect(await within(meditate).findByText(/5 day/)).toBeInTheDocument();
  });

  it("rolls the counters back and shows a toast when the server rejects the log", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.post(api("/habits/habit-1/log/"), () =>
        HttpResponse.json({ detail: "Could not log habit." }, { status: 500 }),
      ),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /log meditate/i }));

    expect(await screen.findByText("Could not log habit.")).toBeInTheDocument();
    expect(within(card("Meditate")).getByText("2/3")).toBeInTheDocument();
  });
});

describe("removing a mistaken log", () => {
  it("undoes one log: counters drop immediately and the server is told", async () => {
    const user = userEvent.setup();
    let unlogged = false;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.post(api("/habits/habit-1/unlog/"), () => {
        unlogged = true;
        return HttpResponse.json(
          habit({ daily_count: 1, weekly_count: 4, monthly_count: 19 }),
        );
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /more meditate/i }));
    await user.click(screen.getByRole("button", { name: /undo log/i }));

    const meditate = card("Meditate");
    expect(await within(meditate).findByText("1/3")).toBeInTheDocument();
    expect(within(meditate).getByText("4/10")).toBeInTheDocument();
    expect(within(meditate).getByText("19/40")).toBeInTheDocument();
    expect(unlogged).toBe(true);
  });
});

describe("back-filling a past date", () => {
  it("logs against the chosen date and shows the server's updated counters", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.post(api("/habits/habit-1/log/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(habit({ weekly_count: 6, monthly_count: 21 }));
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /more meditate/i }));
    await user.click(screen.getByRole("button", { name: /log a past day/i }));
    await user.type(screen.getByLabelText(/date/i), "2026-09-10");
    await user.click(screen.getByRole("button", { name: /^log$/i }));

    const meditate = card("Meditate");
    expect(await within(meditate).findByText("6/10")).toBeInTheDocument();
    expect(within(meditate).getByText("21/40")).toBeInTheDocument();
    expect(posted).toMatchObject({ date: "2026-09-10", amount: 1 });
  });
});

describe("archiving and restoring", () => {
  it("archive moves the habit to the archived section and tells the server", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.patch(api("/habits/habit-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(habit({ is_active: false }));
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /more meditate/i }));
    await user.click(screen.getByRole("button", { name: /archive/i }));

    const archived = await screen.findByRole("list", { name: /archived/i });
    expect(within(archived).getByText("Meditate")).toBeInTheDocument();
    // An archived habit cannot be logged.
    expect(screen.queryByRole("button", { name: /log meditate/i })).not.toBeInTheDocument();
    expect(patched).toMatchObject({ is_active: false });
  });

  it("restore brings an archived habit back to the active list", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(api("/habits/"), () =>
        HttpResponse.json(habitsPage([habit({ is_active: false })])),
      ),
      http.patch(api("/habits/habit-1/"), () => HttpResponse.json(habit())),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /restore meditate/i }));

    expect(await screen.findByRole("button", { name: /log meditate/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /archived/i })).not.toBeInTheDocument();
  });
});

describe("editing a habit", () => {
  it("saves a new name and targets and shows them", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.patch(api("/habits/habit-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(habit({ name: "Meditate twice", daily_target: 4 }));
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /more meditate/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const nameInput = screen.getByLabelText(/name/i);
    expect(nameInput).toHaveValue("Meditate");
    await user.clear(nameInput);
    await user.type(nameInput, "Meditate twice");
    const dailyInput = screen.getByLabelText(/daily target/i);
    await user.clear(dailyInput);
    await user.type(dailyInput, "4");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Meditate twice")).toBeInTheDocument();
    expect(within(card("Meditate twice")).getByText("2/4")).toBeInTheDocument();
    expect(patched).toMatchObject({
      name: "Meditate twice",
      daily_target: 4,
      weekly_target: 10,
      monthly_target: 40,
    });
  });
});
