import { screen } from "@testing-library/react";
import { renderApp, seedSession } from "../test/render";
import { server, api, http, HttpResponse, activeUser } from "../test/server";

describe("auth guard", () => {
  it("redirects unauthenticated visitors to the login page", async () => {
    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
  });

  it("renders the requested page for an authenticated user with access", async () => {
    seedSession();
    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: "Today" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
  });

  it("redirects a user whose trial has expired to the trial-expired page", async () => {
    seedSession();
    server.use(
      http.get(api("/auth/user/"), () =>
        HttpResponse.json({
          ...activeUser,
          subscription: {
            ...activeUser.subscription,
            trial_days_remaining: 0,
            has_app_access: false,
          },
        }),
      ),
    );

    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: /trial has ended/i }),
    ).toBeInTheDocument();
  });

  it("returns the user to the page they wanted after logging in", async () => {
    server.use(
      http.post(api("/auth/token/"), () =>
        HttpResponse.json({
          access: "h.eyJ1c2VybmFtZSI6ImFkYW0ifQ.s",
          refresh: "h.e30.s",
        }),
      ),
    );

    renderApp("/habits");
    const user = (await import("@testing-library/user-event")).default.setup();

    await screen.findByRole("heading", { name: /sign in/i });
    await user.type(screen.getByLabelText(/email or username/i), "adam");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const habitsLink = await screen.findByRole("link", { name: "Habits" });
    expect(habitsLink).toHaveAttribute("aria-current", "page");
  });

  it("shows an error instead of a blank screen when the user check fails", async () => {
    seedSession();
    server.use(
      http.get(api("/auth/user/"), () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );

    renderApp("/timer");

    expect(
      await screen.findByText(/couldn't load your account/i),
    ).toBeInTheDocument();
  });

  it("redirects to trial-expired when the API rejects with a trial_expired error", async () => {
    seedSession();
    server.use(
      http.get(api("/auth/user/"), () =>
        HttpResponse.json(
          { detail: "Your free trial has ended.", code: "trial_expired" },
          { status: 403 },
        ),
      ),
    );

    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: /trial has ended/i }),
    ).toBeInTheDocument();
  });
});
