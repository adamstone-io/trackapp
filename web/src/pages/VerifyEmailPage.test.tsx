import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../test/render";
import { server, api, http, HttpResponse } from "../test/server";

describe("verify email", () => {
  it("verifies the token from the link and offers login", async () => {
    let receivedToken: string | null = null;
    server.use(
      http.get(api("/auth/verify-email/"), ({ request }) => {
        receivedToken = new URL(request.url).searchParams.get("token");
        return HttpResponse.json({ detail: "Email verified. You can now log in." });
      }),
    );

    renderApp("/verify-email?token=abc123");

    expect(
      await screen.findByText(/email verified\. you can now log in\./i),
    ).toBeInTheDocument();
    expect(receivedToken).toBe("abc123");
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows the error for an invalid or expired token", async () => {
    server.use(
      http.get(api("/auth/verify-email/"), () =>
        HttpResponse.json(
          { detail: "Invalid or expired verification link." },
          { status: 400 },
        ),
      ),
    );

    renderApp("/verify-email?token=stale");

    expect(
      await screen.findByText(/invalid or expired verification link/i),
    ).toBeInTheDocument();
  });

  it("prefills the resend form with the email typed at login", async () => {
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

    await user.type(screen.getByLabelText(/email or username/i), "newbie@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: /verify your email/i });
    expect(screen.getByLabelText(/email/i)).toHaveValue("newbie@example.com");
  });

  it("lets an unverified user request a new link when arriving without a token", async () => {
    let resendBody: Record<string, string> | null = null;
    server.use(
      http.post(api("/auth/resend-verification/"), async ({ request }) => {
        resendBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json({
          detail: "If that email is registered and unverified, we've sent a new link.",
        });
      }),
    );

    renderApp("/verify-email");
    const user = userEvent.setup();

    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "newbie@example.com");
    await user.click(screen.getByRole("button", { name: /resend/i }));

    expect(
      await screen.findByText(/we've sent a new link/i),
    ).toBeInTheDocument();
    expect(resendBody).toEqual({ email: "newbie@example.com" });
  });
});
