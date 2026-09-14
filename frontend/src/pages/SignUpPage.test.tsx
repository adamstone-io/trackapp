import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../test/render";
import { server, http, HttpResponse, api } from "../test/server";

/** Fill the whole form; overrides replace individual fields. */
async function fillForm(overrides: Record<string, string> = {}) {
  const values = {
    Username: "adam",
    Email: "adam@example.com",
    Password: "quite-a-password",
    "Invite code": "4595",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    if (value === "") continue;
    await userEvent.type(screen.getByLabelText(label), value);
  }
}

describe("signing up", () => {
  it("creates the account and says to check the inbox", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/register/"), async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { detail: "Account created. Check your email to verify your account." },
          { status: 201 },
        );
      }),
    );

    renderApp("/register");
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(sent).toEqual({
      username: "adam",
      email: "adam@example.com",
      password: "quite-a-password",
      registration_code: "4595",
    });
  });

  it("offers a resend only as a fallback, not as the next step", async () => {
    server.use(
      http.post(api("/auth/register/"), () =>
        HttpResponse.json({ detail: "Account created." }, { status: 201 }),
      ),
    );

    renderApp("/register");
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/the link in that email activates your account/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /send it again/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });

  it("shows the server's refusal and keeps what was typed", async () => {
    server.use(
      http.post(api("/auth/register/"), () =>
        HttpResponse.json({ detail: "Invalid registration code." }, { status: 403 }),
      ),
    );

    renderApp("/register");
    await fillForm({ "Invite code": "0000" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Invalid registration code.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("adam");
  });

  it("reaches the login page and back", async () => {
    renderApp("/register");

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });
});

describe("the login page", () => {
  it("points people without an account at sign-up", async () => {
    renderApp("/login");

    expect(await screen.findByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
