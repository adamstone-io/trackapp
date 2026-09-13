import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

beforeEach(() => {
  seedSession();
  serveCategories([]);
});

/** Backend shape: GET /api/study-items/ is paginated. */
function page(rows: object[], next: string | null = null) {
  return { count: rows.length, next, previous: null, results: rows };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    prompt: "Kanji: 水",
    notes: "water; the radical in 泳",
    category: "kanji",
    image_url: null,
    note_image_url: null,
    prime_count: 3,
    study_count: 1,
    first_primed_at: "2026-09-01T10:00:00Z",
    last_primed_at: "2026-09-10T10:00:00Z",
    first_studied_at: "2026-09-02T10:00:00Z",
    last_studied_at: "2026-09-08T10:00:00Z",
    is_archived: false,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function serve(items: object[]) {
  server.use(http.get(api("/study-items/"), () => HttpResponse.json(page(items))));
}

function serveCategories(categories: { category: string; count: number }[]) {
  server.use(http.get(api("/study-items/categories/"), () => HttpResponse.json(categories)));
}

function row(title: string): HTMLElement {
  return screen.getByText(title).closest("li")!;
}

describe("study items list", () => {
  it("shows each item with title, category, notes, and interaction stats", async () => {
    serve([item()]);

    renderApp("/study");

    expect(await screen.findByText("Kanji: 水")).toBeInTheDocument();
    const card = row("Kanji: 水");
    expect(within(card).getByText("kanji")).toBeInTheDocument();
    expect(within(card).getByText("water; the radical in 泳")).toBeInTheDocument();
    expect(within(card).getByText(/3 primes/i)).toBeInTheDocument();
    expect(within(card).getByText(/1 study/i)).toBeInTheDocument();
  });

  it("shows first-ever and most-recent dates for prime and study", async () => {
    serve([item()]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    const card = row("Kanji: 水");
    const primeStat = within(card).getByText(/3 primes/i);
    expect(primeStat).toHaveAttribute("title", expect.stringMatching(/first .*1 Sept?.*last .*10 Sept?/i));
    const studyStat = within(card).getByText(/1 study/i);
    expect(studyStat).toHaveAttribute("title", expect.stringMatching(/first .*2 Sept?.*last .*8 Sept?/i));
  });

  it("shows the item's image when it has one", async () => {
    serve([item({ image_url: "http://files.example/water.png" })]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    const image = row("Kanji: 水").querySelector("img")!;
    expect(image).toHaveAttribute("src", "http://files.example/water.png");
  });

  it("orders never-touched items first, then least-recently-touched", async () => {
    serve([
      item({ id: "recent", prompt: "Recent", last_primed_at: "2026-09-12T10:00:00Z" }),
      item({
        id: "never",
        prompt: "Never touched",
        prime_count: 0,
        study_count: 0,
        first_primed_at: null,
        last_primed_at: null,
        first_studied_at: null,
        last_studied_at: null,
      }),
      item({
        id: "stale",
        prompt: "Stale",
        last_primed_at: "2026-08-20T10:00:00Z",
        last_studied_at: "2026-08-15T10:00:00Z",
      }),
    ]);

    renderApp("/study");
    await screen.findByText("Never touched");

    const titles = within(screen.getByRole("list", { name: /study items/i }))
      .getAllByRole("listitem")
      .map((li) => li.querySelector("h3")?.textContent);
    expect(titles).toEqual(["Never touched", "Stale", "Recent"]);
  });
});

describe("logging interactions", () => {
  it("posts an explicit prime interaction and shows the updated count", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/log_interaction/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(item({ prime_count: 4, last_primed_at: "2026-09-13T10:00:00Z" }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /log prime for kanji: 水/i }));

    expect(await screen.findByText(/4 primes/i)).toBeInTheDocument();
    expect(posted).toEqual({ interaction: "prime" });
  });

  it("posts a study interaction from the Log Study button", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/log_interaction/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(item({ study_count: 2 }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /log study for kanji: 水/i }));

    expect(await screen.findByText(/2 studies/i)).toBeInTheDocument();
    expect(posted).toEqual({ interaction: "study" });
  });

  it("disables Log Study on items without notes", async () => {
    serve([item({ notes: "" })]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    expect(screen.getByRole("button", { name: /log study for kanji: 水/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /log prime for kanji: 水/i })).toBeEnabled();
  });

  it("rolls the count back and shows a toast when logging fails", async () => {
    const user = userEvent.setup();
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/log_interaction/"), () =>
        HttpResponse.json({ detail: "Could not log the interaction." }, { status: 500 }),
      ),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /log prime for kanji: 水/i }));

    expect(await screen.findByText("Could not log the interaction.")).toBeInTheDocument();
    expect(screen.getByText(/3 primes/i)).toBeInTheDocument();
  });
});

describe("creating a study item", () => {
  it("posts title, notes, and category and shows the new item", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    serve([]);
    server.use(
      http.post(api("/study-items/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          item({ id: "item-new", ...posted, prime_count: 0, study_count: 0 }),
          { status: 201 },
        );
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));
    await user.type(screen.getByLabelText(/title/i), "Kanji: 火");
    await user.type(screen.getByLabelText(/notes/i), "fire");
    await user.type(screen.getByLabelText("Category"), "kanji");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Kanji: 火")).toBeInTheDocument();
    expect(posted).toEqual({ prompt: "Kanji: 火", notes: "fire", category: "kanji" });
  });

  it("uploads the chosen image after creating and shows it", async () => {
    const user = userEvent.setup();
    let uploadContentType: string | null = null;
    serve([]);
    server.use(
      http.post(api("/study-items/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          item({ id: "item-new", ...body, prime_count: 0, study_count: 0 }),
          { status: 201 },
        );
      }),
      // Reading a multipart body hangs in the MSW interceptor under jsdom,
      // so assert on the content-type header instead of the form fields.
      http.post(api("/study-items/item-new/upload_image/"), ({ request }) => {
        uploadContentType = request.headers.get("content-type");
        return HttpResponse.json(
          item({ id: "item-new", prompt: "Kanji: 火", image_url: "http://files.example/fire.png" }),
        );
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));
    await user.type(screen.getByLabelText(/title/i), "Kanji: 火");
    await user.upload(
      screen.getByLabelText(/image/i),
      new File(["png-bytes"], "fire.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByText("Kanji: 火");
    await waitFor(() =>
      expect(row("Kanji: 火").querySelector("img")).toHaveAttribute(
        "src",
        "http://files.example/fire.png",
      ),
    );
    expect(uploadContentType).toMatch(/^multipart\/form-data/);
  });

  it("autocompletes the category from existing categories", async () => {
    const user = userEvent.setup();
    serve([]);
    serveCategories([
      { category: "kanji", count: 4 },
      { category: "guitar", count: 2 },
    ]);

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));

    const input = screen.getByLabelText("Category");
    const datalist = document.getElementById(input.getAttribute("list")!)!;
    const values = Array.from(datalist.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(["kanji", "guitar"]);
  });
});

describe("editing a study item", () => {
  it("saves the changes and shows them", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    serve([item()]);
    server.use(
      http.patch(api("/study-items/item-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(item({ prompt: "Kanji: 水 (mizu)" }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveValue("Kanji: 水");
    await user.clear(titleInput);
    await user.type(titleInput, "Kanji: 水 (mizu)");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Kanji: 水 (mizu)")).toBeInTheDocument();
    expect(patched).toMatchObject({
      prompt: "Kanji: 水 (mizu)",
      notes: "water; the radical in 泳",
      category: "kanji",
    });
  });
});

describe("archiving and restoring", () => {
  it("archives an item into the archived section and restores it back", async () => {
    const user = userEvent.setup();
    const patches: Record<string, unknown>[] = [];
    serve([item()]);
    server.use(
      http.patch(api("/study-items/item-1/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json(item({ is_archived: body.is_archived }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    const archived = await screen.findByRole("list", { name: /archived study items/i });
    expect(within(archived).getByText("Kanji: 水")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore kanji: 水/i }));
    expect(await screen.findByRole("button", { name: /more kanji: 水/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /archived study items/i })).not.toBeInTheDocument();
    expect(patches).toEqual([{ is_archived: true }, { is_archived: false }]);
  });
});

describe("category filter", () => {
  it("filters the list to the typed category and offers autocomplete options", async () => {
    const user = userEvent.setup();
    serve([
      item(),
      item({ id: "item-2", prompt: "Barre chords", category: "guitar" }),
    ]);
    serveCategories([
      { category: "kanji", count: 1 },
      { category: "guitar", count: 1 },
    ]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    const filter = screen.getByLabelText(/filter by category/i);
    const datalist = document.getElementById(filter.getAttribute("list")!)!;
    expect(Array.from(datalist.querySelectorAll("option")).map((o) => o.value)).toEqual([
      "kanji",
      "guitar",
    ]);

    await user.type(filter, "gui");
    expect(screen.getByText("Barre chords")).toBeInTheDocument();
    expect(screen.queryByText("Kanji: 水")).not.toBeInTheDocument();

    await user.clear(filter);
    expect(screen.getByText("Kanji: 水")).toBeInTheDocument();
  });
});
