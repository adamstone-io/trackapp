import { screen, waitFor, within } from "@testing-library/react";
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

  it("shows only the periods the habit is aimed at", async () => {
    server.use(
      http.get(api("/habits/"), () =>
        HttpResponse.json(
          habitsPage([
            habit({ weekly_target: 0, monthly_target: 0 }),
            habit({
              id: "habit-2",
              name: "Deep clean",
              daily_target: 0,
              weekly_target: 0,
              monthly_target: 2,
              monthly_count: 1,
            }),
            habit({
              id: "habit-3",
              name: "Stretch",
              daily_target: 0,
              weekly_target: 0,
              monthly_target: 0,
              daily_count: 7,
            }),
          ]),
        ),
      ),
    );

    renderApp("/habits");
    await screen.findByText("Meditate");

    // Daily habit: its weekly and monthly tallies are noise.
    const meditate = card("Meditate");
    expect(within(meditate).getByText("2/3")).toBeInTheDocument();
    expect(within(meditate).queryByText("W")).not.toBeInTheDocument();
    expect(within(meditate).queryByText("M")).not.toBeInTheDocument();

    // Monthly habit: no daily or weekly counter.
    const clean = card("Deep clean");
    expect(within(clean).getByText("1/2")).toBeInTheDocument();
    expect(within(clean).queryByText("D")).not.toBeInTheDocument();
    expect(within(clean).queryByText("W")).not.toBeInTheDocument();

    // No target at all: today's count still shows, or the row has no number.
    expect(within(card("Stretch")).getByText("7")).toBeInTheDocument();
  });

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

  it("keeps rapid taps' optimistic counts when an earlier response lands late", async () => {
    const user = userEvent.setup();
    const releases: (() => void)[] = [];
    let call = 0;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.post(api("/habits/habit-1/log/"), async () => {
        const index = call++;
        await new Promise<void>((resolve) => (releases[index] = resolve));
        return HttpResponse.json(
          index === 0
            ? habit({ daily_count: 3, weekly_count: 6, monthly_count: 21, streak_count: 5 })
            : habit({ daily_count: 4, weekly_count: 7, monthly_count: 22, streak_count: 5 }),
        );
      }),
    );

    renderApp("/habits");
    const logButton = await screen.findByRole("button", { name: /log meditate/i });
    await user.click(logButton);
    await user.click(logButton);

    const meditate = card("Meditate");
    expect(within(meditate).getByText("4/3")).toBeInTheDocument();

    // The first response is stale while the second log is still pending;
    // applying it would visibly rewind the counter to 3/3.
    releases[0]();
    await expect(within(meditate).findByText("3/3", {}, { timeout: 250 })).rejects.toThrow();
    expect(within(meditate).getByText("4/3")).toBeInTheDocument();

    releases[1]();
    expect(await within(meditate).findByText(/5 day/)).toBeInTheDocument();
    expect(within(meditate).getByText("4/3")).toBeInTheDocument();
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
    // The count lets a single back-fill meet a daily target greater than one.
    const countInput = screen.getByLabelText(/count/i);
    await user.clear(countInput);
    await user.type(countInput, "3");
    await user.click(screen.getByRole("button", { name: /^log$/i }));

    const meditate = card("Meditate");
    expect(await within(meditate).findByText("6/10")).toBeInTheDocument();
    expect(within(meditate).getByText("21/40")).toBeInTheDocument();
    expect(posted).toMatchObject({ date: "2026-09-10", amount: 3 });
  });
});

describe("archiving and restoring", () => {
  /** The page shows only live habits now; the retired ones are a page away. */
  async function openArchive(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: /page actions/i }));
    await user.click(screen.getByRole("button", { name: /^archived$/i }));
  }

  it("archive takes the habit off the list and tells the server", async () => {
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

    // Gone from the page, and no longer something that can be logged.
    await waitFor(() => expect(screen.queryByText("Meditate")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /log meditate/i })).not.toBeInTheDocument();
    expect(patched).toMatchObject({ is_active: false });
  });

  it("restores a habit from the archived page", async () => {
    const user = userEvent.setup();
    // Stateful, so navigating back asks the server and gets the restored
    // habit rather than the archived one it started as.
    let active = false;
    server.use(
      http.get(api("/habits/"), () =>
        HttpResponse.json(habitsPage([habit({ is_active: active })])),
      ),
      http.patch(api("/habits/habit-1/"), async ({ request }) => {
        active = Boolean((await request.json() as Record<string, unknown>).is_active);
        return HttpResponse.json(habit({ is_active: active }));
      }),
    );

    renderApp("/habits");
    await openArchive(user);

    await user.click(await screen.findByRole("button", { name: /restore meditate/i }));

    // It leaves the archive, and the way back finds it live again.
    await waitFor(() => expect(screen.queryByText("Meditate")).not.toBeInTheDocument());
    await user.click(screen.getByRole("link", { name: "← Habits" }));
    expect(await screen.findByRole("button", { name: /log meditate/i })).toBeInTheDocument();
  });

  it("deletes an archived habit for good, but only after confirming", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;
    server.use(
      http.get(api("/habits/"), () =>
        HttpResponse.json(habitsPage([habit({ is_active: false })])),
      ),
      http.delete(api("/habits/habit-1/"), () => {
        deleted = "habit-1";
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/habits");
    await openArchive(user);

    await user.click(await screen.findByRole("button", { name: /more habit meditate/i }));
    // One press arms it and says what it costs; the second does it.
    await user.click(screen.getByRole("button", { name: /delete permanently/i }));
    expect(screen.getByText(/go for good/i)).toBeInTheDocument();
    expect(deleted).toBeNull();

    await user.click(screen.getByRole("button", { name: /confirm delete/i }));
    await waitFor(() => expect(deleted).toBe("habit-1"));
  });
});

describe("deleting a habit", () => {
  it("asks for confirmation, then deletes and removes the row", async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.use(
      http.get(api("/habits/"), () => HttpResponse.json(habitsPage([habit()]))),
      http.delete(api("/habits/habit-1/"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/habits");
    await user.click(await screen.findByRole("button", { name: /more meditate/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Nothing happens until the confirmation click.
    expect(deleted).toBe(false);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(screen.queryByText("Meditate")).not.toBeInTheDocument();
    expect(deleted).toBe(true);
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
