import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

beforeEach(() => {
  seedSession();
});

/** Backend shape: GET /api/projects/ is paginated. */
function page(rows: object[], next: string | null = null) {
  return { count: rows.length, next, previous: null, results: rows };
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    name: "TrackApp",
    description: "The tracking app",
    color: "#4f7fd9",
    archived: false,
    total_seconds: 6000,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function serve(projects: object[]) {
  server.use(http.get(api("/projects/"), () => HttpResponse.json(page(projects))));
}

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("li")!;
}

describe("projects list", () => {
  it("shows each project with description, tracked time, and its color", async () => {
    serve([project()]);

    renderApp("/workspace");

    expect(await screen.findByText("TrackApp")).toBeInTheDocument();
    const card = row("TrackApp");
    expect(within(card).getByText("The tracking app")).toBeInTheDocument();
    expect(within(card).getByText("1h 40m")).toBeInTheDocument();
    const dot = card.querySelector("[data-color]");
    expect(dot).toHaveAttribute("data-color", "#4f7fd9");
  });
});

describe("creating a project", () => {
  it("posts the name, description, and picked color and shows the new project", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([]);
    server.use(
      http.post(api("/projects/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(project({ id: "project-new", ...posted }), { status: 201 });
      }),
    );

    renderApp("/workspace");

    await user.click(await screen.findByRole("button", { name: /add project/i }));
    await user.type(screen.getByLabelText(/name/i), "Writing");
    await user.type(screen.getByLabelText(/description/i), "Blog posts");
    await user.click(screen.getByRole("radio", { name: /green/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Writing")).toBeInTheDocument();
    expect(posted).toMatchObject({
      name: "Writing",
      description: "Blog posts",
      color: "#4fa06a",
    });
  });
});

describe("editing a project", () => {
  it("saves the changes and shows them", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    serve([project()]);
    server.use(
      http.patch(api("/projects/project-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(project({ name: "TrackApp v2" }));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const nameInput = screen.getByLabelText(/name/i);
    expect(nameInput).toHaveValue("TrackApp");
    await user.clear(nameInput);
    await user.type(nameInput, "TrackApp v2");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("TrackApp v2")).toBeInTheDocument();
    expect(patched).toMatchObject({ name: "TrackApp v2", description: "The tracking app" });
  });
});

describe("archiving and restoring", () => {
  /** The workspace shows only live projects; the retired ones are a page away. */
  async function openArchive(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: /page actions/i }));
    await user.click(screen.getByRole("button", { name: /^archived$/i }));
  }

  it("archives a project off the workspace and restores it from the archive", async () => {
    const user = userEvent.setup();
    const patches: Record<string, unknown>[] = [];
    let archived = false;
    server.use(
      http.get(api("/projects/"), () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [project({ archived })],
        }),
      ),
      http.patch(api("/projects/project-1/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        archived = Boolean(body.archived);
        return HttpResponse.json(project({ archived }));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(screen.queryByText("TrackApp")).not.toBeInTheDocument());

    await openArchive(user);
    expect(await screen.findByText("TrackApp")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore trackapp/i }));
    await user.click(screen.getByRole("link", { name: "← Workspace" }));

    expect(await screen.findByRole("button", { name: /more trackapp/i })).toBeInTheDocument();
    expect(patches).toEqual([{ archived: true }, { archived: false }]);
  });

  it("keeps retired projects off the workspace entirely", async () => {
    serve([project(), project({ id: "project-2", name: "Old thing", archived: true })]);

    renderApp("/workspace");
    await screen.findByText("TrackApp");

    expect(screen.queryByText("Old thing")).not.toBeInTheDocument();
  });

  it("deletes an archived project for good, but only after confirming", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;
    serve([project({ archived: true })]);
    server.use(
      http.delete(api("/projects/project-1/"), () => {
        deleted = "project-1";
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/workspace");
    await openArchive(user);

    await user.click(await screen.findByRole("button", { name: /more project trackapp/i }));
    await user.click(screen.getByRole("button", { name: /delete permanently/i }));
    // Armed, and saying what it costs — nothing has gone yet.
    expect(screen.getByText(/tasks keep their history/i)).toBeInTheDocument();
    expect(deleted).toBeNull();

    await user.click(screen.getByRole("button", { name: /confirm delete/i }));
    await waitFor(() => expect(deleted).toBe("project-1"));
  });
});

describe("deleting a project", () => {
  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup();
    let deleted = false;
    serve([project()]);
    server.use(
      http.delete(api("/projects/project-1/"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Nothing happens until the confirmation click.
    expect(deleted).toBe(false);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(screen.queryByText("TrackApp")).not.toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("rolls the project back and shows a toast when the delete fails", async () => {
    const user = userEvent.setup();
    serve([project()]);
    server.use(
      http.delete(api("/projects/project-1/"), () =>
        HttpResponse.json({ detail: "Could not delete project." }, { status: 500 }),
      ),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(await screen.findByText("Could not delete project.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more trackapp/i })).toBeInTheDocument();
  });
});

describe("a project's time entries", () => {
  function entry(overrides: Record<string, unknown> = {}) {
    return {
      id: "te-1",
      task: "task-1",
      task_title: "Write spec",
      started_at: "2026-09-12T10:00:00Z",
      ended_at: "2026-09-12T11:30:00Z",
      duration_seconds: 5400,
      notes: "",
      breaks: [],
      ...overrides,
    };
  }

  it("lists the project's entries in a modal from the ⋮ menu", async () => {
    const user = userEvent.setup();
    let requestedUrl = "";
    serve([project()]);
    server.use(
      http.get(api("/time-entries/"), ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json(page([entry(), entry({ id: "te-2", task_title: "Review" })]));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /time entries/i }));

    const dialog = await screen.findByRole("dialog", { name: /trackapp/i });
    expect(within(dialog).getByText("Write spec")).toBeInTheDocument();
    expect(within(dialog).getByText("Review")).toBeInTheDocument();
    expect(within(dialog).getAllByText("1h 30m")).toHaveLength(2);
    // Scoped to this project, not the whole log.
    expect(requestedUrl).toContain("project=project-1");
  });

  it("says so when the project has no entries, and closes on Escape", async () => {
    const user = userEvent.setup();
    serve([project()]);
    server.use(http.get(api("/time-entries/"), () => HttpResponse.json(page([]))));

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /time entries/i }));

    const dialog = await screen.findByRole("dialog", { name: /trackapp/i });
    expect(within(dialog).getByText(/no time logged against this project yet/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads the next page when there is one", async () => {
    const user = userEvent.setup();
    const pagesSeen: string[] = [];
    serve([project()]);
    server.use(
      http.get(api("/time-entries/"), ({ request }) => {
        const pageParam = new URL(request.url).searchParams.get("page") ?? "1";
        pagesSeen.push(pageParam);
        return pageParam === "1"
          ? HttpResponse.json(page([entry()], "http://next"))
          : HttpResponse.json(page([entry({ id: "te-9", task_title: "Older work" })]));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /time entries/i }));

    const dialog = await screen.findByRole("dialog", { name: /trackapp/i });
    await user.click(within(dialog).getByRole("button", { name: /load more/i }));

    expect(await within(dialog).findByText("Older work")).toBeInTheDocument();
    expect(pagesSeen).toEqual(["1", "2"]);
  });
});

describe("scheduled tasks", () => {
  /** Local "YYYY-MM-DD" for today, the day the section opens on. */
  function todayIso(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /** An ISO timestamp at HH:MM local today. */
  function at(hours: number, minutes = 0): string {
    const day = new Date();
    day.setHours(hours, minutes, 0, 0);
    return day.toISOString();
  }

  function task(overrides: Record<string, unknown> = {}) {
    return {
      id: "task-1",
      title: "Write the spec",
      category: "other",
      project: null,
      notes: "",
      archived: false,
      total_seconds: 0,
      entry_count: 0,
      planned_start: at(9),
      planned_duration: 3600,
      first_started_at: null,
      ...overrides,
    };
  }

  function serveTasks(tasks: object[]) {
    server.use(http.get(api("/tasks/"), () => HttpResponse.json(page(tasks))));
  }

  it("lists the day's tasks with their slot, ordered by the backend", async () => {
    serve([project()]);
    serveTasks([task(), task({ id: "task-2", title: "Review PRs", planned_start: at(15, 30) })]);

    renderApp("/workspace");

    const list = await screen.findByRole("list", { name: /scheduled/i });
    const rows = within(list).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Write the spec")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/09:00 · 1h/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Review PRs")).toBeInTheDocument();
  });

  it("asks for the chosen day's tasks", async () => {
    const requested: string[] = [];
    serve([project()]);
    server.use(
      http.get(api("/tasks/"), ({ request }) => {
        const date = new URL(request.url).searchParams.get("planned_date");
        if (date) requested.push(date);
        return HttpResponse.json(page([]));
      }),
    );

    renderApp("/workspace");
    await screen.findByText(/nothing scheduled/i);
    expect(requested).toEqual([todayIso()]);

    // A date input takes a whole value, not keystrokes.
    fireEvent.change(screen.getByLabelText(/day to schedule/i), {
      target: { value: "2026-09-20" },
    });

    await waitFor(() => expect(requested).toContain("2026-09-20"));
  });

  it("schedules a task for the chosen day at the chosen time", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([project()]);
    serveTasks([]);
    server.use(
      http.post(api("/tasks/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(task({ id: "task-new", ...posted }), { status: 201 });
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /add scheduled task/i }));
    await user.type(screen.getByLabelText(/^task$/i), "Deep work");
    await user.type(screen.getByLabelText(/^start$/i), "09:00");
    await user.type(screen.getByLabelText(/^end$/i), "10:30");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ title: "Deep work", planned_duration: 5400 });
    // Planned start is the chosen day at the chosen local time.
    expect(new Date(posted!.planned_start as string).getHours()).toBe(9);
    expect(await screen.findByText("Deep work")).toBeInTheDocument();
  });

  it("starts the timer for a task and moves to the timer page", async () => {
    const user = userEvent.setup();
    let startedTimer: Record<string, unknown> | null = null;
    serve([project()]);
    serveTasks([task()]);
    // The timer page reads the server's active timer when it loads.
    let active: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/active-timer/"), async ({ request }) => {
        startedTimer = (await request.json()) as Record<string, unknown>;
        active = { id: 1, created_at: new Date().toISOString(), ...startedTimer };
        return HttpResponse.json(active, { status: 201 });
      }),
      http.get(api("/active-timer/"), () => HttpResponse.json(active)),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /start write the spec/i }));

    await waitFor(() => expect(startedTimer).not.toBeNull());
    // The planned length becomes the countdown, and the entry keeps the task.
    expect(startedTimer).toMatchObject({
      task: "task-1",
      task_title: "Write the spec",
      mode: "countdown",
      target_duration: 3600,
    });
    expect(await screen.findByRole("timer")).toBeInTheDocument();
  });

  it("shows how the actual start compared with the plan", async () => {
    serve([project()]);
    serveTasks([
      task({ first_started_at: at(9, 12) }),
      task({ id: "task-2", title: "Standup", planned_start: at(10), first_started_at: at(10) }),
    ]);

    renderApp("/workspace");
    await screen.findByText("Write the spec");

    const late = screen.getByText("Write the spec").closest("li")!;
    expect(within(late).getByText(/12 min late/i)).toBeInTheDocument();
    const punctual = screen.getByText("Standup").closest("li")!;
    expect(within(punctual).getByText(/on time/i)).toBeInTheDocument();
  });
});
