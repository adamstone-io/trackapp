import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, fakeJwt } from "../test/render";
import { server, api, http, HttpResponse } from "../test/server";
import { getAccessToken, getRefreshToken } from "../auth/tokens";

describe("login", () => {
  it("signs in with credentials, stores tokens, and lands on the dashboard", async () => {
    let credentials: Record<string, string> | null = null;
    server.use(
      http.post(api("/auth/token/"), async ({ request }) => {
        credentials = (await request.json()) as Record<string, string>;
        return HttpResponse.json({
          access: fakeJwt({ username: "adam" }),
          refresh: fakeJwt({ type: "refresh" }),
        });
      }),
    );

    renderApp("/login");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email or username/i), "adam@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const dashboardLink = await screen.findByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");

    expect(credentials).toEqual({ username: "adam@example.com", password: "hunter2" });
    expect(getAccessToken()).toBeTruthy();
    expect(getRefreshToken()).toBeTruthy();
  });

  it("shows the server's error message when credentials are rejected", async () => {
    server.use(
      http.post(api("/auth/token/"), () =>
        HttpResponse.json(
          { detail: "No active account found with the given credentials" },
          { status: 401 },
        ),
      ),
    );

    renderApp("/login");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email or username/i), "adam");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/no active account found/i),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it("redirects to the verify-email page when the account is unverified", async () => {
    server.use(
      http.post(api("/auth/token/"), () =>
        HttpResponse.json(
          { detail: ["Please verify your email before logging in. Check your inbox."] },
          { status: 400 },
        ),
      ),
    );

    renderApp("/login");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email or username/i), "newbie");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /verify your email/i }),
      ).toBeInTheDocument(),
    );
  });
});
