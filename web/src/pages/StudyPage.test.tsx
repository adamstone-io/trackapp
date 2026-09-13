import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";
import { playInteractionLoggedSound } from "../lib/sounds";

vi.mock("../lib/sounds", () => ({ playInteractionLoggedSound: vi.fn() }));

beforeEach(() => {
  seedSession();
  serveCategories([]);
  vi.mocked(playInteractionLoggedSound).mockClear();
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
    last_reviewed_at: null,
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

/** Both the prompt and the answer offer Text/Image, so radios are scoped. */
function answerKind(label: "Text" | "Image"): HTMLElement {
  return within(screen.getByRole("group", { name: /answer/i })).getByRole("radio", { name: label });
}

function promptKind(label: "Text" | "Image"): HTMLElement {
  return within(screen.getByRole("group", { name: /prompt/i })).getByRole("radio", { name: label });
}

describe("study items list", () => {
  it("shows the prompt side and interaction stats, with the answer hidden", async () => {
    serve([item()]);

    renderApp("/study");

    expect(await screen.findByText("Kanji: 水")).toBeInTheDocument();
    const card = row("Kanji: 水");
    expect(within(card).getByText("kanji")).toBeInTheDocument();
    expect(within(card).getByText(/3 primes/i)).toBeInTheDocument();
    expect(within(card).getByText(/1 study/i)).toBeInTheDocument();
    // The answer waits behind the Study button.
    expect(within(card).queryByText("water; the radical in 泳")).not.toBeInTheDocument();
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

  it("shows the prompt image, and reveals an image answer on Study", async () => {
    const user = userEvent.setup();
    serve([
      item({
        notes: "",
        image_url: "http://files.example/water.png",
        note_image_url: "http://files.example/water-note.png",
      }),
    ]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    const card = row("Kanji: 水");
    expect(within(card).getByAltText(/prompt image/i)).toHaveAttribute(
      "src",
      "http://files.example/water.png",
    );
    expect(within(card).queryByAltText(/note image/i)).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /show the answer/i }));
    expect(within(card).getByAltText(/note image/i)).toHaveAttribute(
      "src",
      "http://files.example/water-note.png",
    );
  });

  it("shows the creation date and how long since the last prime and study", async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    serve([
      item({
        created_at: "2026-08-01T12:00:00Z",
        last_primed_at: daysAgo(3),
        last_studied_at: daysAgo(20),
      }),
      item({
        id: "item-2",
        prompt: "Kanji: 火",
        study_count: 0,
        first_studied_at: null,
        last_studied_at: null,
      }),
    ]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    const card = row("Kanji: 水");
    expect(within(card).getByText(/created 1 aug 2026/i)).toBeInTheDocument();
    expect(within(card).getByText(/3 primes · 3 days ago/i)).toBeInTheDocument();
    expect(within(card).getByText(/1 study · 20 days ago/i)).toBeInTheDocument();
    expect(within(row("Kanji: 火")).getByText(/0 studies · never/i)).toBeInTheDocument();
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
      // Legacy items whose only interactions were reviews still count as touched.
      item({
        id: "reviewed",
        prompt: "Reviewed once",
        prime_count: 0,
        study_count: 0,
        first_primed_at: null,
        last_primed_at: null,
        first_studied_at: null,
        last_studied_at: null,
        last_reviewed_at: "2026-08-10T10:00:00Z",
      }),
    ]);

    renderApp("/study");
    await screen.findByText("Never touched");

    const titles = within(screen.getByRole("list", { name: /study items/i }))
      .getAllByRole("listitem")
      .map((li) => li.querySelector("h3")?.textContent);
    expect(titles).toEqual(["Never touched", "Reviewed once", "Stale", "Recent"]);
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

  it("reveals the answer first, then logs the study on the next press", async () => {
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
    await user.click(await screen.findByRole("button", { name: /show the answer for kanji: 水/i }));

    // First press only reveals — nothing is logged yet.
    expect(screen.getByText("water; the radical in 泳")).toBeInTheDocument();
    expect(posted).toBeNull();

    await user.click(screen.getByRole("button", { name: /finish studying kanji: 水/i }));

    expect(await screen.findByText(/2 studies/i)).toBeInTheDocument();
    expect(posted).toEqual({ interaction: "study" });
    // Done with it: the answer goes away again.
    expect(screen.queryByText("water; the radical in 泳")).not.toBeInTheDocument();
  });

  it("disables Study on an item with no answer, but not on an image answer", async () => {
    serve([
      item({ notes: "" }),
      item({ id: "item-2", prompt: "Kanji: 火", notes: "", note_image_url: "http://x/fire.png" }),
    ]);

    renderApp("/study");
    await screen.findByText("Kanji: 水");

    expect(screen.getByRole("button", { name: /show the answer for kanji: 水/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /log prime for kanji: 水/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /show the answer for kanji: 火/i })).toBeEnabled();
  });

  it("plays the confirmation sound once the interaction is recorded", async () => {
    const user = userEvent.setup();
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/log_interaction/"), () =>
        HttpResponse.json(item({ prime_count: 4 })),
      ),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /log prime for kanji: 水/i }));

    await waitFor(() => expect(playInteractionLoggedSound).toHaveBeenCalled());
  });

  it("stays silent when the interaction is rejected", async () => {
    const user = userEvent.setup();
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/log_interaction/"), () =>
        HttpResponse.json({ detail: "Could not log the interaction." }, { status: 500 }),
      ),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /log prime for kanji: 水/i }));

    await screen.findByText("Could not log the interaction.");
    expect(playInteractionLoggedSound).not.toHaveBeenCalled();
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
    await user.type(screen.getByLabelText("Prompt"), "Kanji: 火");
    await user.type(screen.getByLabelText(/notes/i), "fire");
    await user.type(screen.getByLabelText("Category"), "Kanji");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Kanji: 火")).toBeInTheDocument();
    // The typed case is preserved — rewriting it would fork existing categories.
    expect(posted).toEqual({ prompt: "Kanji: 火", notes: "fire", category: "Kanji" });
  });

  it("keeps the created item and explains when only the note image fails", async () => {
    const user = userEvent.setup();
    serve([]);
    server.use(
      http.post(api("/study-items/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          item({ id: "item-new", ...body, prime_count: 0, study_count: 0 }),
          { status: 201 },
        );
      }),
      http.post(api("/study-items/item-new/upload_note_image/"), () =>
        HttpResponse.json({ detail: "Image too large. Maximum size: 10MB" }, { status: 400 }),
      ),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));
    await user.type(screen.getByLabelText("Prompt"), "Kanji: 火");
    await user.click(answerKind("Image"));
    await user.upload(
      screen.getByLabelText("Note image"),
      new File(["png-bytes"], "huge.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("Saved the study item, but the note image failed to save."),
    ).toBeInTheDocument();
    expect(screen.getByText("Kanji: 火")).toBeInTheDocument();
  });

  it("sends an image prompt with the create, and the row carries no text", async () => {
    const user = userEvent.setup();
    let createContentType: string | null = null;
    let separateUploads = 0;
    serve([]);
    server.use(
      // Reading a multipart body hangs in the MSW interceptor under jsdom,
      // so assert on the content-type header instead of the form fields.
      http.post(api("/study-items/"), ({ request }) => {
        createContentType = request.headers.get("content-type");
        return HttpResponse.json(
          item({
            id: "item-new",
            prompt: "",
            notes: "",
            category: "",
            image_url: "http://files.example/fire.png",
            prime_count: 0,
            study_count: 0,
          }),
          { status: 201 },
        );
      }),
      http.post(api("/study-items/item-new/upload_image/"), () => {
        separateUploads += 1;
        return HttpResponse.json(item({ id: "item-new" }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));
    await user.click(promptKind("Image"));
    // No text prompt to fill in — the image is the prompt.
    expect(screen.queryByLabelText("Prompt")).not.toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("Prompt image"),
      new File(["png-bytes"], "fire.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    const image = await screen.findByAltText(/prompt image/i);
    expect(image).toHaveAttribute("src", "http://files.example/fire.png");
    expect(createContentType).toMatch(/^multipart\/form-data/);
    // The item would not validate without its image, so it rides the create.
    expect(separateUploads).toBe(0);
    // Menus still have something to call it.
    expect(screen.getByRole("button", { name: /more untitled/i })).toBeInTheDocument();
  });

  it("uploads a note image to its own endpoint and shows it under the notes", async () => {
    const user = userEvent.setup();
    let promptUploads = 0;
    serve([]);
    server.use(
      http.post(api("/study-items/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          item({ id: "item-new", ...body, prime_count: 0, study_count: 0 }),
          { status: 201 },
        );
      }),
      http.post(api("/study-items/item-new/upload_image/"), () => {
        promptUploads += 1;
        return HttpResponse.json(item({ id: "item-new", prompt: "Kanji: 火" }));
      }),
      http.post(api("/study-items/item-new/upload_note_image/"), () =>
        HttpResponse.json(
          item({
            id: "item-new",
            prompt: "Kanji: 火",
            note_image_url: "http://files.example/fire-note.png",
          }),
        ),
      ),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /add study item/i }));
    await user.type(screen.getByLabelText("Prompt"), "Kanji: 火");
    await user.click(answerKind("Image"));
    await user.upload(
      screen.getByLabelText("Note image"),
      new File(["png-bytes"], "fire-note.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByText("Kanji: 火");
    await user.click(
      await screen.findByRole("button", { name: /show the answer for kanji: 火/i }),
    );
    await waitFor(() =>
      expect(within(row("Kanji: 火")).getByAltText(/note image/i)).toHaveAttribute(
        "src",
        "http://files.example/fire-note.png",
      ),
    );
    // The untouched prompt slot is left alone.
    expect(promptUploads).toBe(0);
  });

  it("removes one image without disturbing the other", async () => {
    const user = userEvent.setup();
    const removed: string[] = [];
    serve([
      item({
        image_url: "http://files.example/water.png",
        note_image_url: "http://files.example/water-note.png",
      }),
    ]);
    server.use(
      http.patch(api("/study-items/item-1/"), () =>
        HttpResponse.json(
          item({
            image_url: "http://files.example/water.png",
            note_image_url: "http://files.example/water-note.png",
          }),
        ),
      ),
      http.delete(api("/study-items/item-1/remove_note_image/"), () => {
        removed.push("note_image");
        return HttpResponse.json(item({ image_url: "http://files.example/water.png" }));
      }),
      http.delete(api("/study-items/item-1/remove_image/"), () => {
        removed.push("image");
        return HttpResponse.json(item({ note_image_url: "http://files.example/water-note.png" }));
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    await user.click(screen.getByLabelText(/remove note image/i));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(removed).toEqual(["note_image"]));
    const card = row("Kanji: 水");
    expect(within(card).queryByAltText(/note image/i)).not.toBeInTheDocument();
    expect(within(card).getByAltText(/prompt image/i)).toBeInTheDocument();
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

    const promptInput = screen.getByLabelText("Prompt");
    expect(promptInput).toHaveValue("Kanji: 水");
    await user.clear(promptInput);
    await user.type(promptInput, "Kanji: 水 (mizu)");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Kanji: 水 (mizu)")).toBeInTheDocument();
    expect(patched).toMatchObject({
      prompt: "Kanji: 水 (mizu)",
      notes: "water; the radical in 泳",
      category: "kanji",
    });
  });
});

describe("the answer is text or an image, never both", () => {
  it("clears the text note when the answer is switched to an image", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    let uploaded = false;
    serve([item()]);
    server.use(
      http.patch(api("/study-items/item-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(item({ notes: "" }));
      }),
      http.post(api("/study-items/item-1/upload_note_image/"), () => {
        uploaded = true;
        return HttpResponse.json(
          item({ notes: "", note_image_url: "http://files.example/water-note.png" }),
        );
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    // The text note is the answer today, so its field is the one on show.
    expect(screen.getByLabelText(/notes/i)).toHaveValue("water; the radical in 泳");
    await user.click(answerKind("Image"));
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("Note image"),
      new File(["png-bytes"], "water-note.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(uploaded).toBe(true));
    expect(patched).toMatchObject({ notes: "" });
  });

  it("uploads the image before clearing the prompt text when the prompt becomes an image", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    let patched: Record<string, unknown> | null = null;
    serve([item()]);
    server.use(
      http.post(api("/study-items/item-1/upload_image/"), () => {
        order.push("upload");
        return HttpResponse.json(item({ image_url: "http://files.example/water.png" }));
      }),
      http.patch(api("/study-items/item-1/"), async ({ request }) => {
        order.push("patch");
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          item({ prompt: "", image_url: "http://files.example/water.png" }),
        );
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    await user.click(promptKind("Image"));
    await user.upload(
      screen.getByLabelText("Prompt image"),
      new File(["png-bytes"], "water.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patched).toMatchObject({ prompt: "" }));
    // The backend needs the item to hold a prompt or an image at every point.
    expect(order).toEqual(["upload", "patch"]);
  });

  it("leaves a legacy item holding both alone until the kind is changed", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    const removals: string[] = [];
    serve([item({ note_image_url: "http://files.example/water-note.png" })]);
    server.use(
      http.patch(api("/study-items/item-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(item({ prompt: "Kanji: 水 (mizu)" }));
      }),
      http.delete(api("/study-items/item-1/remove_note_image/"), () => {
        removals.push("note_image");
        return HttpResponse.json(item());
      }),
    );

    renderApp("/study");
    await user.click(await screen.findByRole("button", { name: /more kanji: 水/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const promptField = screen.getByLabelText("Prompt");
    await user.clear(promptField);
    await user.type(promptField, "Kanji: 水 (mizu)");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByText("Kanji: 水 (mizu)");
    // Neither side of the answer was touched: no wipe, no removal.
    expect(patched).toMatchObject({ notes: "water; the radical in 泳" });
    expect(removals).toEqual([]);
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
