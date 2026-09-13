import { screen, within } from "@testing-library/react";
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

    renderApp("/projects");

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

    renderApp("/projects");

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

    renderApp("/projects");
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
  it("archives a project into the archived section and restores it back", async () => {
    const user = userEvent.setup();
    const patches: Record<string, unknown>[] = [];
    serve([project()]);
    server.use(
      http.patch(api("/projects/project-1/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json(project({ archived: body.archived }));
      }),
    );

    renderApp("/projects");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    const archived = await screen.findByRole("list", { name: /archived projects/i });
    expect(within(archived).getByText("TrackApp")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore trackapp/i }));
    expect(await screen.findByRole("button", { name: /more trackapp/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /archived projects/i })).not.toBeInTheDocument();
    expect(patches).toEqual([{ archived: true }, { archived: false }]);
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

    renderApp("/projects");
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

    renderApp("/projects");
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

    renderApp("/projects");
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

    renderApp("/projects");
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

    renderApp("/projects");
    await user.click(await screen.findByRole("button", { name: /more trackapp/i }));
    await user.click(screen.getByRole("button", { name: /time entries/i }));

    const dialog = await screen.findByRole("dialog", { name: /trackapp/i });
    await user.click(within(dialog).getByRole("button", { name: /load more/i }));

    expect(await within(dialog).findByText("Older work")).toBeInTheDocument();
    expect(pagesSeen).toEqual(["1", "2"]);
  });
});
