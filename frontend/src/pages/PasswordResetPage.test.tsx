import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

const GENERIC = "If that email is on an account, we've sent a reset link.";

describe("asking for a reset link", () => {
  it("offers the way in from the login page", async () => {
    const user = userEvent.setup();

    renderApp("/login");
    await user.click(await screen.findByRole("link", { name: /forgot your password/i }));

    expect(await screen.findByRole("heading", { name: /reset your password/i })).toBeInTheDocument();
  });

  it("carries an email typed into the login form over to the form", async () => {
    const user = userEvent.setup();

    renderApp("/login");
    await user.type(await screen.findByLabelText(/email or username/i), "adam@example.com");
    await user.click(screen.getByRole("link", { name: /forgot your password/i }));

    expect(await screen.findByLabelText(/^email$/i)).toHaveValue("adam@example.com");
  });

  it("leaves a username behind rather than prefilling an email field with it", async () => {
    const user = userEvent.setup();

    renderApp("/login");
    await user.type(await screen.findByLabelText(/email or username/i), "adam");
    await user.click(screen.getByRole("link", { name: /forgot your password/i }));

    expect(await screen.findByLabelText(/^email$/i)).toHaveValue("");
  });

  it("says the same thing whatever the address, and says how long the link lasts", async () => {
    const user = userEvent.setup();
    let sentTo: unknown = null;
    server.use(
      http.post(api("/auth/password-reset/"), async ({ request }) => {
        sentTo = ((await request.json()) as { email: string }).email;
        return HttpResponse.json({ detail: GENERIC });
      }),
    );

    renderApp("/forgot-password");
    await user.type(await screen.findByLabelText(/^email$/i), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    // Deliberately not "we sent it" or "no such account" — the endpoint is
    // open, so the answer must not say who has an account.
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(screen.getByText(/good for one hour/i)).toBeInTheDocument();
    expect(sentTo).toBe("nobody@example.com");
  });
});

describe("spending the reset link", () => {
  it("sets the new password and sends you to log in", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/password-reset/confirm/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ detail: "Password reset. You can now log in." });
      }),
    );

    renderApp("/reset-password?token=abc-123");
    await user.type(await screen.findByLabelText(/^new password$/i), "correct-horse-battery");
    await user.type(screen.getByLabelText(/confirm new password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(await screen.findByText(/password reset/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
    expect(body).toEqual({ token: "abc-123", new_password: "correct-horse-battery" });
  });

  it("catches a mistyped confirmation before asking the server", async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(api("/auth/password-reset/confirm/"), () => {
        called = true;
        return HttpResponse.json({ detail: "Password reset." });
      }),
    );

    renderApp("/reset-password?token=abc-123");
    await user.type(await screen.findByLabelText(/^new password$/i), "correct-horse-battery");
    await user.type(screen.getByLabelText(/confirm new password/i), "correct-horse-bettery");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows what the server says when the link is spent or stale", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(api("/auth/password-reset/confirm/"), () =>
        HttpResponse.json(
          { detail: "That reset link is no longer valid. Request a new one." },
          { status: 400 },
        ),
      ),
    );

    renderApp("/reset-password?token=spent");
    await user.type(await screen.findByLabelText(/^new password$/i), "correct-horse-battery");
    await user.type(screen.getByLabelText(/confirm new password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(await screen.findByText(/no longer valid/i)).toBeInTheDocument();
  });

  it("points at a fresh request when the link arrives without a token", async () => {
    renderApp("/reset-password");

    expect(await screen.findByText(/missing its token/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeInTheDocument();
  });
});
