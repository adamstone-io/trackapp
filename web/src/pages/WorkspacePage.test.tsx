import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

beforeEach(() => {
  seedSession();
});

/** Backend shape: GET /api/projects/ and /api/tasks/ are paginated. */
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

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Write docs",
    category: "other",
    project: "project-1",
    notes: "",
    archived: false,
    total_seconds: 1500,
    entry_count: 2,
    created_at: "2026-08-02T00:00:00Z",
    ...overrides,
  };
}

function serve(projects: object[], tasks: object[]) {
  server.use(
    http.get(api("/projects/"), () => HttpResponse.json(page(projects))),
    http.get(api("/tasks/"), () => HttpResponse.json(page(tasks))),
  );
}

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("li")!;
}

describe("workspace lists", () => {
  it("shows each project with description, tracked time, and its color", async () => {
    serve([project()], []);

    renderApp("/workspace");

    expect(await screen.findByText("TrackApp")).toBeInTheDocument();
    const card = row("TrackApp");
    expect(within(card).getByText("The tracking app")).toBeInTheDocument();
    expect(within(card).getByText("1h 40m")).toBeInTheDocument();
    const dot = card.querySelector("[data-color]");
    expect(dot).toHaveAttribute("data-color", "#4f7fd9");
  });

  it("shows each task with its tracked time, category, and project", async () => {
    serve(
      [project()],
      [
        task({ category: "deep work" }),
        task({ id: "task-2", title: "Errands", project: null, total_seconds: 0 }),
      ],
    );

    renderApp("/workspace");

    expect(await screen.findByText("Write docs")).toBeInTheDocument();
    const docs = row("Write docs");
    expect(within(docs).getByText("25m")).toBeInTheDocument();
    expect(within(docs).getByText("deep work")).toBeInTheDocument();
    expect(within(docs).getByText("TrackApp")).toBeInTheDocument();

    // No project chip and no invented category on an unassigned task.
    const errands = row("Errands");
    expect(within(errands).queryByText("TrackApp")).not.toBeInTheDocument();
    expect(within(errands).queryByText("other")).not.toBeInTheDocument();
  });
});

describe("creating", () => {
  it("posts a new project with name, description, and picked color", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([], []);
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

  it("posts a new task with title, category, and chosen project", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([project()], []);
    server.use(
      http.post(api("/tasks/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(task({ id: "task-new", ...posted }), { status: 201 });
      }),
    );

    renderApp("/workspace");

    await user.click(await screen.findByRole("button", { name: /add task/i }));
    await user.type(screen.getByLabelText(/title/i), "Draft spec");
    await user.type(screen.getByLabelText(/category/i), "writing");
    await user.selectOptions(screen.getByRole("combobox", { name: /project/i }), "TrackApp");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Draft spec")).toBeInTheDocument();
    expect(posted).toMatchObject({
      title: "Draft spec",
      category: "writing",
      project: "project-1",
    });
  });
});

describe("editing", () => {
  it("saves project changes and shows them", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    serve([project()], []);
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

  it("saves task changes, including moving it to another project", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    serve([project(), project({ id: "project-2", name: "Blog" })], [task()]);
    server.use(
      http.patch(api("/tasks/task-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(task({ title: "Write better docs", project: "project-2" }));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more write docs/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveValue("Write docs");
    await user.clear(titleInput);
    await user.type(titleInput, "Write better docs");
    await user.selectOptions(screen.getByRole("combobox", { name: /project/i }), "Blog");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Write better docs")).toBeInTheDocument();
    expect(within(row("Write better docs")).getByText("Blog")).toBeInTheDocument();
    expect(patched).toMatchObject({ title: "Write better docs", project: "project-2" });
  });
});

describe("archiving and restoring", () => {
  it("archives a project into the archived section and restores it back", async () => {
    const user = userEvent.setup();
    const patches: Record<string, unknown>[] = [];
    serve([project()], []);
    server.use(
      http.patch(api("/projects/project-1/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json(project({ archived: body.archived }));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    const archived = await screen.findByRole("list", { name: /archived projects/i });
    expect(within(archived).getByText("TrackApp")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore trackapp/i }));
    expect(await screen.findByRole("button", { name: /more trackapp/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /archived projects/i })).not.toBeInTheDocument();
    expect(patches).toEqual([{ archived: true }, { archived: false }]);
  });

  it("archives a task into the archived section and restores it back", async () => {
    const user = userEvent.setup();
    serve([project()], [task()]);
    server.use(
      http.patch(api("/tasks/task-1/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(task({ archived: body.archived }));
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more write docs/i }));
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    const archived = await screen.findByRole("list", { name: /archived tasks/i });
    expect(within(archived).getByText("Write docs")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore write docs/i }));
    expect(await screen.findByRole("button", { name: /more write docs/i })).toBeInTheDocument();
  });
});

describe("deleting a project", () => {
  it("asks for confirmation, deletes, and unassigns the project's tasks", async () => {
    const user = userEvent.setup();
    let deleted = false;
    serve([project()], [task()]);
    server.use(
      http.delete(api("/projects/project-1/"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/workspace");
    expect(await screen.findByText("Write docs")).toBeInTheDocument();
    expect(within(row("Write docs")).getByText("TrackApp")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Nothing happens until the confirmation click.
    expect(deleted).toBe(false);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(screen.queryByRole("button", { name: /more trackapp/i })).not.toBeInTheDocument();
    // The task survives, now unassigned.
    expect(within(row("Write docs")).queryByText("TrackApp")).not.toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("rolls the project back and shows a toast when the delete fails", async () => {
    const user = userEvent.setup();
    serve([project()], [task()]);
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
    expect(within(row("Write docs")).getByText("TrackApp")).toBeInTheDocument();
  });
});

describe("deleting a task", () => {
  it("deletes on confirmation", async () => {
    const user = userEvent.setup();
    let deleted = false;
    serve([project()], [task()]);
    server.use(
      http.delete(api("/tasks/task-1/"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/workspace");
    await user.click(await screen.findByRole("button", { name: /more write docs/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(screen.queryByText("Write docs")).not.toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("refreshes the project totals the deleted task's entries counted toward", async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.use(
      http.get(api("/projects/"), () =>
        HttpResponse.json(page([project({ total_seconds: deleted ? 4500 : 6000 })])),
      ),
      http.get(api("/tasks/"), () => HttpResponse.json(page([task()]))),
      http.delete(api("/tasks/task-1/"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp("/workspace");
    expect(await screen.findByText("1h 40m")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /more write docs/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(await screen.findByText("1h 15m")).toBeInTheDocument();
  });
});
