import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";
import { playTimerFinishedSound } from "../lib/sounds";

vi.mock("../lib/sounds", () => ({ playTimerFinishedSound: vi.fn() }));

beforeEach(() => {
  seedSession();
});

/** Backend shape: GET /api/today-entries/ returns a combined, pre-sorted list. */
const todayEntriesFixture = [
  {
    type: "time_entry",
    id: "te-2",
    sort_time: "2026-09-12T10:00:00Z",
    data: {
      id: "te-2",
      task: "task-1",
      task_title: "Write spec",
      started_at: "2026-09-12T10:00:00Z",
      ended_at: "2026-09-12T11:30:00Z",
      duration_seconds: 5400,
      notes: "",
      breaks: [],
      project_name: "TrackApp",
      project_color: "#e8613a",
    },
  },
  {
    type: "moment",
    id: "m-1",
    sort_time: "2026-09-12T09:15:00Z",
    data: {
      id: "m-1",
      description: "Had an idea about spacing",
      category: "general",
      timestamp: "2026-09-12T09:15:00Z",
      task: null,
      task_title: "",
      is_milestone: false,
    },
  },
  {
    type: "time_entry",
    id: "te-1",
    sort_time: "2026-09-12T08:00:00Z",
    data: {
      id: "te-1",
      task: "task-2",
      task_title: "Morning review",
      started_at: "2026-09-12T08:00:00Z",
      ended_at: "2026-09-12T08:20:00Z",
      duration_seconds: 1200,
      notes: "",
      breaks: [],
    },
  },
];

describe("starting a stopwatch timer", () => {
  it("creates the active timer on the server and shows the running view", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/active-timer/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, created_at: "2026-09-12T10:00:00Z", ...posted }, { status: 201 });
      }),
    );

    renderApp("/timer");

    await user.type(await screen.findByLabelText(/task/i), "Deep work");
    await user.click(screen.getByRole("button", { name: /start/i }));

    // Running view: task title + elapsed readout, start controls gone.
    const timerRegion = await screen.findByRole("timer");
    expect(timerRegion).toHaveTextContent(/00:00:0\d/);
    expect(within(screen.getByRole("main")).getByText("Deep work")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();

    expect(posted).toMatchObject({
      task_title: "Deep work",
      task: null,
      elapsed_seconds: 0,
      is_paused: false,
      mode: "stopwatch",
      target_duration: null,
    });
    expect(typeof posted!.started_at).toBe("string");
  });

  it("rolls back to the start form and shows a toast when the server rejects the start", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(api("/active-timer/"), () =>
        HttpResponse.json({ detail: "Could not start timer." }, { status: 500 }),
      ),
    );

    renderApp("/timer");

    await user.type(await screen.findByLabelText(/task/i), "Deep work");
    await user.click(screen.getByRole("button", { name: /start/i }));

    expect(await screen.findByText("Could not start timer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("defaults a blank task title to Untitled", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/active-timer/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, created_at: "2026-09-12T10:00:00Z", ...posted }, { status: 201 });
      }),
    );

    renderApp("/timer");

    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /start/i }));

    await screen.findByRole("timer");
    expect(posted).toMatchObject({ task_title: "Untitled" });
  });
});

function runningTimer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    task_title: "Deep work",
    task: null,
    started_at: new Date().toISOString(),
    elapsed_seconds: 0,
    is_paused: false,
    mode: "stopwatch",
    target_duration: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("timer state persistence", () => {
  it("restores a running timer from the server on page load", async () => {
    // Started 10 minutes ago with 2 minutes checkpointed before that segment.
    server.use(
      http.get(api("/active-timer/"), () =>
        HttpResponse.json(
          runningTimer({
            started_at: new Date(Date.now() - 600_000).toISOString(),
            elapsed_seconds: 120,
          }),
        ),
      ),
    );

    renderApp("/timer");

    const readout = await screen.findByRole("timer");
    expect(readout).toHaveTextContent(/00:12:0\d/);
    expect(within(screen.getByRole("main")).getByText("Deep work")).toBeInTheDocument();
    // A timer is already running — starting another must be impossible.
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
  });

  it("ticks the readout forward while the timer runs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(
        http.get(api("/active-timer/"), () => HttpResponse.json(runningTimer())),
      );

      renderApp("/timer");
      const readout = await screen.findByRole("timer");

      await act(async () => {
        vi.advanceTimersByTime(65_000);
      });

      expect(readout).toHaveTextContent(/00:01:0\d/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pause and resume", () => {
  it("checkpoints elapsed time on pause and restarts the segment on resume", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      const patches: Record<string, unknown>[] = [];
      let current = runningTimer({ started_at: new Date(Date.now() - 30_000).toISOString() });
      server.use(
        http.get(api("/active-timer/"), () => HttpResponse.json(current)),
        http.patch(api("/active-timer/"), async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patches.push(body);
          current = { ...current, ...body };
          return HttpResponse.json(current);
        }),
      );

      renderApp("/timer");
      const readout = await screen.findByRole("timer");
      expect(readout).toHaveTextContent("00:00:30");

      await user.click(screen.getByRole("button", { name: /pause/i }));
      await waitFor(() => expect(patches).toHaveLength(1));
      expect(patches[0]).toMatchObject({ is_paused: true, elapsed_seconds: 30 });

      // The readout must freeze while paused.
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(readout).toHaveTextContent("00:00:30");

      await user.click(screen.getByRole("button", { name: /resume/i }));
      await waitFor(() => expect(patches).toHaveLength(2));
      expect(patches[1]).toMatchObject({ is_paused: false, elapsed_seconds: 30 });
      expect(typeof patches[1].started_at).toBe("string");

      // And tick again after resuming.
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
      expect(readout).toHaveTextContent(/00:00:3[5-9]/);
    } finally {
      vi.useRealTimers();
    }
  });
});

function stopHandlers({
  timer = undefined as Record<string, unknown> | undefined,
  tasks = [] as Array<Record<string, unknown>>,
  entryStatus = 201,
  entryGate = undefined as Promise<void> | undefined,
} = {}) {
  const calls = {
    deleted: false,
    createdTask: null as Record<string, unknown> | null,
    createdEntry: null as Record<string, unknown> | null,
  };
  const activeTimer =
    timer ??
    runningTimer({
      started_at: new Date(Date.now() - 30_000).toISOString(),
      created_at: new Date(Date.now() - 30_000).toISOString(),
    });
  server.use(
    http.get(api("/active-timer/"), () => HttpResponse.json(activeTimer)),
    http.delete(api("/active-timer/"), () => {
      calls.deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(api("/tasks/"), () =>
      HttpResponse.json({ count: tasks.length, next: null, previous: null, results: tasks }),
    ),
    http.post(api("/tasks/"), async ({ request }) => {
      calls.createdTask = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { id: "task-new", title: calls.createdTask.title, category: "other", project: null },
        { status: 201 },
      );
    }),
    http.post(api("/time-entries/"), async ({ request }) => {
      calls.createdEntry = (await request.json()) as Record<string, unknown>;
      if (entryGate) await entryGate;
      if (entryStatus !== 201) {
        return HttpResponse.json({ detail: "Could not save entry." }, { status: entryStatus });
      }
      return HttpResponse.json({ id: "entry-1", notes: "", breaks: [], ...calls.createdEntry }, { status: 201 });
    }),
  );
  return calls;
}

describe("stopping the timer", () => {
  it("shows the entry in today's log immediately and records it against a matching task", async () => {
    const user = userEvent.setup();
    let releaseEntry!: () => void;
    const entryGate = new Promise<void>((resolve) => (releaseEntry = resolve));
    const calls = stopHandlers({
      tasks: [{ id: "task-9", title: "deep WORK", category: "other", project: null }],
      entryGate,
    });

    renderApp("/timer");
    await screen.findByRole("timer");
    await user.click(screen.getByRole("button", { name: /stop/i }));

    // Optimistic: the entry is in the log while the server has not yet responded.
    const log = await screen.findByRole("list", { name: /today/i });
    expect(within(log).getByText("Deep work")).toBeInTheDocument();

    // Start controls come back — the session is over.
    expect(await screen.findByRole("button", { name: /start/i })).toBeInTheDocument();

    releaseEntry();
    await waitFor(() => expect(calls.createdEntry).not.toBeNull());
    // The server-side timer is cleared only after the entry is safely recorded.
    await waitFor(() => expect(calls.deleted).toBe(true));
    // Task titles match case-insensitively — no duplicate task created.
    expect(calls.createdTask).toBeNull();
    expect(calls.createdEntry).toMatchObject({
      task: "task-9",
      task_title: "Deep work",
      notes: "",
      breaks: [],
    });
    const duration = calls.createdEntry!.duration_seconds as number;
    expect(duration).toBeGreaterThanOrEqual(29);
    expect(duration).toBeLessThanOrEqual(32);
    expect(typeof calls.createdEntry!.started_at).toBe("string");
    expect(typeof calls.createdEntry!.ended_at).toBe("string");

    // The optimistic entry survives server confirmation.
    expect(within(log).getByText("Deep work")).toBeInTheDocument();
  });

  it("creates the task first when no existing task matches the title", async () => {
    const user = userEvent.setup();
    const calls = stopHandlers({ tasks: [{ id: "task-1", title: "Something else", category: "other", project: null }] });

    renderApp("/timer");
    await screen.findByRole("timer");
    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => expect(calls.createdEntry).not.toBeNull());
    expect(calls.createdTask).toMatchObject({ title: "Deep work" });
    expect(calls.createdEntry).toMatchObject({ task: "task-new" });
  });

  it("removes the optimistic entry and shows an auto-dismissing error toast when the server rejects", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      let releaseEntry!: () => void;
      const entryGate = new Promise<void>((resolve) => (releaseEntry = resolve));
      stopHandlers({
        tasks: [{ id: "task-9", title: "Deep work", category: "other", project: null }],
        entryStatus: 500,
        entryGate,
      });

      renderApp("/timer");
      await screen.findByRole("timer");
      await user.click(screen.getByRole("button", { name: /stop/i }));

      const log = await screen.findByRole("list", { name: /today/i });
      expect(within(log).getByText("Deep work")).toBeInTheDocument();
      releaseEntry();

      // Rollback: entry gone, toast shown, and the still-running session restored.
      const toast = await screen.findByText("Could not save entry.");
      expect(screen.queryByRole("list", { name: /today/i })).not.toBeInTheDocument();
      expect(screen.getByRole("timer")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();

      // Toast auto-dismisses after a few seconds.
      await act(async () => {
        vi.advanceTimersByTime(4_500);
      });
      expect(toast).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("countdown mode", () => {
  it("strips non-numeric input and starts with the duration in seconds", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/active-timer/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, created_at: "2026-09-12T10:00:00Z", ...posted }, { status: 201 });
      }),
    );

    renderApp("/timer");
    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /countdown/i }));

    const duration = screen.getByLabelText(/minutes/i);
    await user.type(duration, "2a5x");
    expect(duration).toHaveValue("25");

    await user.type(screen.getByLabelText(/task/i), "Focus block");
    await user.click(screen.getByRole("button", { name: /start/i }));

    await screen.findByRole("timer");
    expect(posted).toMatchObject({
      task_title: "Focus block",
      mode: "countdown",
      target_duration: 1500,
    });
  });

  it("shows remaining time and the percentage of time used", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(
        http.get(api("/active-timer/"), () =>
          HttpResponse.json(
            runningTimer({
              mode: "countdown",
              target_duration: 600,
              started_at: new Date(Date.now() - 60_000).toISOString(),
            }),
          ),
        ),
      );

      renderApp("/timer");
      const readout = await screen.findByRole("timer");
      // 60 of 600 seconds used → 9 minutes remain, 10% used.
      expect(readout).toHaveTextContent(/00:09:00|00:08:5\d/);
      expect(screen.getByText(/10% used/i)).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByText(/20% used/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops itself and records the entry when the countdown reaches zero", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = stopHandlers({
        timer: runningTimer({
          mode: "countdown",
          target_duration: 600,
          started_at: new Date(Date.now() - 590_000).toISOString(),
          created_at: new Date(Date.now() - 590_000).toISOString(),
        }),
        tasks: [{ id: "task-9", title: "Deep work", category: "other", project: null }],
      });

      renderApp("/timer");
      await screen.findByRole("timer");

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });

      await waitFor(() => expect(calls.createdEntry).not.toBeNull());
      const duration = calls.createdEntry!.duration_seconds as number;
      expect(duration).toBeGreaterThanOrEqual(599);
      expect(duration).toBeLessThanOrEqual(605);

      const log = await screen.findByRole("list", { name: /today/i });
      expect(within(log).getByText("Deep work")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("plays the completion sound when the countdown reaches zero", async () => {
    vi.mocked(playTimerFinishedSound).mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stopHandlers({
        timer: runningTimer({
          mode: "countdown",
          target_duration: 600,
          started_at: new Date(Date.now() - 590_000).toISOString(),
          created_at: new Date(Date.now() - 590_000).toISOString(),
        }),
        tasks: [{ id: "task-9", title: "Deep work", category: "other", project: null }],
      });

      renderApp("/timer");
      await screen.findByRole("timer");
      expect(playTimerFinishedSound).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });

      await waitFor(() => expect(playTimerFinishedSound).toHaveBeenCalledTimes(1));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("duration favorites", () => {
  const FAVORITES_KEY = "tempotrack_favorites_duration";

  function storedSeconds(): number[] {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw).map((f: { data: { seconds: number } }) => f.data.seconds) : [];
  }

  it("shows stored favorites in countdown mode and clicking one fills the minutes input", async () => {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify([
        { id: 1, type: "duration", label: "Pomodoro", data: { seconds: 1500 }, order: 0 },
        { id: 2, type: "duration", label: "50 min", data: { seconds: 3000 }, order: 1 },
      ]),
    );
    const user = userEvent.setup();

    renderApp("/timer");
    await screen.findByLabelText(/task/i);

    // Not visible in stopwatch mode.
    expect(screen.queryByRole("button", { name: "Pomodoro" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /countdown/i }));
    await user.click(screen.getByRole("button", { name: "Pomodoro" }));

    expect(screen.getByLabelText(/minutes/i)).toHaveValue("25");
  });

  it("seeds starter favorites when none are stored", async () => {
    const user = userEvent.setup();

    renderApp("/timer");
    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /countdown/i }));

    expect(screen.getByRole("button", { name: "20 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 min" })).toBeInTheDocument();
  });

  it("saves the current minutes as a favorite", async () => {
    const user = userEvent.setup();

    renderApp("/timer");
    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /countdown/i }));

    await user.type(screen.getByLabelText(/minutes/i), "35");
    await user.click(screen.getByRole("button", { name: /save favorite/i }));

    expect(screen.getByRole("button", { name: "35 min" })).toBeInTheDocument();
    expect(storedSeconds()).toContain(35 * 60);
  });

  it("deletes a favorite", async () => {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify([
        { id: 1, type: "duration", label: "20 min", data: { seconds: 1200 }, order: 0 },
        { id: 2, type: "duration", label: "50 min", data: { seconds: 3000 }, order: 1 },
      ]),
    );
    const user = userEvent.setup();

    renderApp("/timer");
    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /countdown/i }));

    await user.click(screen.getByRole("button", { name: "Remove 20 min" }));

    expect(screen.queryByRole("button", { name: "20 min" })).not.toBeInTheDocument();
    expect(storedSeconds()).toEqual([3000]);
  });
});

describe("renaming a time entry", () => {
  it("renames a time entry by clicking its title in the log", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    const entryData = {
      id: "te-1",
      task: "task-1",
      task_title: "Write spec",
      started_at: "2026-09-12T10:00:00Z",
      ended_at: "2026-09-12T11:30:00Z",
      duration_seconds: 5400,
      notes: "",
      breaks: [],
    };
    server.use(
      http.get(api("/today-entries/"), () =>
        HttpResponse.json([{ type: "time_entry", id: "te-1", sort_time: entryData.started_at, data: entryData }]),
      ),
      http.patch(api("/time-entries/te-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...entryData, ...patched });
      }),
    );

    renderApp("/timer");

    const log = await screen.findByRole("list", { name: /today/i });
    await user.click(within(log).getByRole("button", { name: "Write spec" }));

    const input = within(log).getByLabelText(/entry title/i);
    await user.clear(input);
    await user.type(input, "Write the rebuild spec{Enter}");

    // Optimistic: the new title shows immediately and the editor closes.
    expect(within(log).getByText("Write the rebuild spec")).toBeInTheDocument();
    expect(within(log).queryByLabelText(/entry title/i)).not.toBeInTheDocument();

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toMatchObject({ task_title: "Write the rebuild spec" });
  });
});

describe("manual time entry", () => {
  it("defaults start to the end of the last entry and end to now, then records the entry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date(2026, 8, 12, 14, 30, 0)); // local 14:30
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

      const lastEnd = new Date(2026, 8, 12, 11, 30, 0);
      const lastStart = new Date(2026, 8, 12, 10, 0, 0);
      const calls = stopHandlers({ tasks: [] });
      server.use(
        http.get(api("/active-timer/"), () => HttpResponse.json(null)),
        http.get(api("/today-entries/"), () =>
          HttpResponse.json([
            {
              type: "time_entry",
              id: "te-1",
              sort_time: lastStart.toISOString(),
              data: {
                id: "te-1",
                task: "task-1",
                task_title: "Earlier work",
                started_at: lastStart.toISOString(),
                ended_at: lastEnd.toISOString(),
                duration_seconds: 5400,
                notes: "",
                breaks: [],
              },
            },
          ]),
        ),
      );

      renderApp("/timer");
      await screen.findByRole("list", { name: /today/i });

      await user.click(screen.getByRole("button", { name: /add entry/i }));

      const startInput = screen.getByLabelText(/start/i);
      const endInput = screen.getByLabelText(/end/i);
      expect(startInput).toHaveValue("11:30");
      expect(endInput).toHaveValue("14:30");

      await user.type(screen.getByLabelText(/^task$/i, { selector: "input#manual-task-title" }), "Reading");
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Optimistic: visible in the log right away.
      const log = screen.getByRole("list", { name: /today/i });
      expect(within(log).getByText("Reading")).toBeInTheDocument();

      await waitFor(() => expect(calls.createdEntry).not.toBeNull());
      expect(calls.createdEntry).toMatchObject({
        task: "task-new",
        task_title: "Reading",
        duration_seconds: 10800, // 11:30 → 14:30
      });
      expect(calls.createdTask).toMatchObject({ title: "Reading" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("add moment", () => {
  it("creates a moment from the task title text and shows it in the log immediately", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/moments/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: "m-9", category: "general", task: null, task_title: "", is_milestone: false, ...posted },
          { status: 201 },
        );
      }),
    );

    renderApp("/timer");

    const taskInput = await screen.findByLabelText(/task/i);
    await user.type(taskInput, "Had an idea");
    await user.click(screen.getByRole("button", { name: /add moment/i }));

    // Optimistic: the moment is in the log right away, and no time entry is created
    // (an accidental POST /time-entries/ would fail the unhandled-request check).
    const log = await screen.findByRole("list", { name: /today/i });
    expect(within(log).getByText("Had an idea")).toBeInTheDocument();

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ description: "Had an idea" });
    expect(typeof posted!.timestamp).toBe("string");

    // The text was consumed by the moment.
    expect(taskInput).toHaveValue("");
  });

  it("creates an Untitled moment when the task field is empty", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/moments/"), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: "m-9", category: "general", task: null, task_title: "", is_milestone: false, ...posted },
          { status: 201 },
        );
      }),
    );

    renderApp("/timer");

    await screen.findByLabelText(/task/i);
    await user.click(screen.getByRole("button", { name: /add moment/i }));

    const log = await screen.findByRole("list", { name: /today/i });
    expect(within(log).getByText("Untitled")).toBeInTheDocument();
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ description: "Untitled" });
  });

  it("renames a moment by clicking its text in the log", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    const moment = {
      id: "m-1",
      description: "Untitled",
      category: "general",
      timestamp: "2026-09-12T09:15:00Z",
      task: null,
      task_title: "",
      is_milestone: false,
    };
    server.use(
      http.get(api("/today-entries/"), () =>
        HttpResponse.json([{ type: "moment", id: "m-1", sort_time: moment.timestamp, data: moment }]),
      ),
      http.patch(api("/moments/m-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...moment, ...patched });
      }),
    );

    renderApp("/timer");

    const log = await screen.findByRole("list", { name: /today/i });
    await user.click(within(log).getByRole("button", { name: "Untitled" }));

    const input = within(log).getByLabelText(/moment text/i);
    await user.clear(input);
    await user.type(input, "Saw a great heron{Enter}");

    // Optimistic: the new text shows immediately and the editor closes.
    expect(within(log).getByText("Saw a great heron")).toBeInTheDocument();
    expect(within(log).queryByLabelText(/moment text/i)).not.toBeInTheDocument();

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toMatchObject({ description: "Saw a great heron" });
  });
});

describe("moment category", () => {
  const moment = {
    id: "m-1",
    description: "Saw a great heron",
    category: "general",
    timestamp: "2026-09-12T09:15:00Z",
    task: null,
    task_title: "",
    is_milestone: false,
  };

  it("changes a moment's category from the chip in the log", async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/today-entries/"), () =>
        HttpResponse.json([{ type: "moment", id: "m-1", sort_time: moment.timestamp, data: moment }]),
      ),
      http.patch(api("/moments/m-1/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...moment, ...patched });
      }),
    );

    renderApp("/timer");

    const log = await screen.findByRole("list", { name: /today/i });
    await user.click(within(log).getByRole("button", { name: "general" }));

    const select = within(log).getByLabelText(/moment category/i);
    await user.selectOptions(select, "insight");

    // Optimistic: the chip shows the new category and the picker closes.
    expect(within(log).getByRole("button", { name: "insight" })).toBeInTheDocument();
    expect(within(log).queryByLabelText(/moment category/i)).not.toBeInTheDocument();

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toMatchObject({ category: "insight" });
  });

  it("rolls back the category and shows a toast when the server rejects", async () => {
    const user = userEvent.setup();
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((resolve) => (releasePatch = resolve));
    server.use(
      http.get(api("/today-entries/"), () =>
        HttpResponse.json([{ type: "moment", id: "m-1", sort_time: moment.timestamp, data: moment }]),
      ),
      http.patch(api("/moments/m-1/"), async () => {
        await patchGate;
        return HttpResponse.json({ detail: "nope" }, { status: 500 });
      }),
    );

    renderApp("/timer");

    const log = await screen.findByRole("list", { name: /today/i });
    await user.click(within(log).getByRole("button", { name: "general" }));
    await user.selectOptions(within(log).getByLabelText(/moment category/i), "blocker");

    // Optimistic: the chip shows the new category while the PATCH is in flight.
    expect(within(log).getByRole("button", { name: "blocker" })).toBeInTheDocument();
    releasePatch();

    await screen.findByText("nope");
    expect(within(log).getByRole("button", { name: "general" })).toBeInTheDocument();
    expect(within(log).queryByRole("button", { name: "blocker" })).not.toBeInTheDocument();
  });
});

describe("today's log", () => {
  it("shows time entries and moments combined, in the order the API returns", async () => {
    server.use(
      http.get(api("/today-entries/"), () => HttpResponse.json(todayEntriesFixture)),
    );

    renderApp("/timer");

    const log = await screen.findByRole("list", { name: /today/i });
    const items = within(log).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Write spec");
    expect(items[0]).toHaveTextContent("1h 30m");
    expect(items[1]).toHaveTextContent("Had an idea about spacing");
    expect(items[2]).toHaveTextContent("Morning review");
    expect(items[2]).toHaveTextContent("20m");
  });

  it("shows an empty state when there is nothing logged today", async () => {
    renderApp("/timer");

    expect(await screen.findByText(/nothing logged yet/i)).toBeInTheDocument();
  });
});
