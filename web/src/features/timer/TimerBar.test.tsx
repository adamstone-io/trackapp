import { screen, waitFor } from "@testing-library/react";
import { renderApp, seedSession } from "../../test/render";
import { server, http, HttpResponse, api } from "../../test/server";

beforeEach(() => {
  seedSession();
});

describe("persistent timer bar", () => {
  it("shows task title and elapsed time in the nav on other pages while a timer runs", async () => {
    server.use(
      http.get(api("/active-timer/"), () =>
        HttpResponse.json({
          id: 1,
          task_title: "Deep work",
          task: null,
          started_at: new Date(Date.now() - 30_000).toISOString(),
          elapsed_seconds: 0,
          is_paused: false,
          mode: "stopwatch",
          target_duration: null,
          created_at: new Date(Date.now() - 30_000).toISOString(),
        }),
      ),
    );

    renderApp("/");

    const bar = await screen.findByRole("link", { name: /active timer/i });
    expect(bar).toHaveTextContent("Deep work");
    expect(bar).toHaveTextContent(/00:00:3\d/);
  });

  it("stays hidden on the timer page itself, where the full readout already shows", async () => {
    server.use(
      http.get(api("/active-timer/"), () =>
        HttpResponse.json({
          id: 1,
          task_title: "Deep work",
          task: null,
          started_at: new Date(Date.now() - 30_000).toISOString(),
          elapsed_seconds: 0,
          is_paused: false,
          mode: "stopwatch",
          target_duration: null,
          created_at: new Date(Date.now() - 30_000).toISOString(),
        }),
      ),
    );

    renderApp("/timer");

    // The page's own running view renders...
    await screen.findByRole("timer");
    // ...but the nav bar readout does not.
    expect(screen.queryByRole("link", { name: /active timer/i })).not.toBeInTheDocument();
  });

  it("is absent when no timer is running", async () => {
    renderApp("/");

    // Wait for the dashboard to settle, then confirm there is no timer bar.
    await screen.findByRole("heading", { name: /dashboard/i });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /active timer/i })).not.toBeInTheDocument(),
    );
  });
});
