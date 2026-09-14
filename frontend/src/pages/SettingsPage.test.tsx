import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";
import { server, http, HttpResponse, api, activeUser } from "../test/server";

beforeEach(() => {
  seedSession();
});

function account(overrides: Record<string, unknown> = {}) {
  return { ...activeUser, first_name: "Adam", last_name: "Stone", ...overrides };
}

function seedAccount(overrides: Record<string, unknown> = {}) {
  server.use(http.get(api("/auth/user/"), () => HttpResponse.json(account(overrides))));
}

/** Replace a field's contents. */
async function retype(label: string, value: string) {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

describe("the account section", () => {
  it("shows the names and email on the account", async () => {
    seedAccount();

    renderApp("/settings");

    expect(await screen.findByLabelText("First name")).toHaveValue("Adam");
    expect(screen.getByLabelText("Last name")).toHaveValue("Stone");
    expect(screen.getByLabelText("Email")).toHaveValue("adam@example.com");
  });

  it("shows the username as the fixed login identifier", async () => {
    seedAccount();

    renderApp("/settings");

    expect(await screen.findByText("adam")).toBeInTheDocument();
    // Not a field: the API refuses to change it.
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("saves a changed name and says so", async () => {
    seedAccount();
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.patch(api("/auth/user/"), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(account(patched));
      }),
    );

    renderApp("/settings");
    await screen.findByLabelText("First name");
    await retype("First name", "Adamo");
    await userEvent.click(screen.getByRole("button", { name: "Save account" }));

    expect(await screen.findByText("Account saved.")).toBeInTheDocument();
    expect(patched).toEqual({
      first_name: "Adamo",
      last_name: "Stone",
      email: "adam@example.com",
    });
  });

  it("reports the server's refusal without losing the edit", async () => {
    seedAccount();
    server.use(
      http.patch(api("/auth/user/"), () =>
        HttpResponse.json({ detail: "An account with that email already exists." }, { status: 400 }),
      ),
    );

    renderApp("/settings");
    await screen.findByLabelText("Email");
    await retype("Email", "taken@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save account" }));

    expect(
      await screen.findByText("An account with that email already exists."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("taken@example.com");
  });
});

describe("changing the password", () => {
  it("sends both passwords and returns you to the login page", async () => {
    seedAccount();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.patch(api("/auth/password/"), async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ detail: "Password changed." });
      }),
    );

    renderApp("/settings");
    await userEvent.type(await screen.findByLabelText("Current password"), "hunter2please");
    await userEvent.type(screen.getByLabelText("New password"), "quite-another-one");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    // The backend revokes every refresh token, so the session really is over.
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Password changed. Please log in again.")).toBeInTheDocument();
    expect(localStorage.getItem("authAccessToken")).toBeNull();
    expect(sent).toEqual({
      current_password: "hunter2please",
      new_password: "quite-another-one",
    });
  });

  it("warns that the change will sign you out", async () => {
    seedAccount();

    renderApp("/settings");

    expect(await screen.findByText(/signs you out everywhere/i)).toBeInTheDocument();
  });

  it("shows why the server refused and keeps you where you are", async () => {
    seedAccount();
    server.use(
      http.patch(api("/auth/password/"), () =>
        HttpResponse.json({ detail: "That is not your current password." }, { status: 400 }),
      ),
    );

    renderApp("/settings");
    await userEvent.type(await screen.findByLabelText("Current password"), "wrong");
    await userEvent.type(screen.getByLabelText("New password"), "quite-another-one");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("That is not your current password.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("quite-another-one");
  });
});

describe("logging out", () => {
  it("drops the session and returns to the login page", async () => {
    seedAccount();

    renderApp("/settings");
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("authAccessToken")).toBeNull();
  });
});

describe("the trial", () => {
  it("says how long is left on it", async () => {
    seedAccount();

    renderApp("/settings");

    const section = await screen.findByRole("region", { name: "Subscription" });
    expect(within(section).getByText(/30 days/)).toBeInTheDocument();
  });

  it("says so when the account is not on a trial", async () => {
    seedAccount({
      subscription: { ...activeUser.subscription, is_subscribed: true, trial_days_remaining: null },
    });

    renderApp("/settings");

    const section = await screen.findByRole("region", { name: "Subscription" });
    await waitFor(() => expect(within(section).getByText(/subscribed/i)).toBeInTheDocument());
  });
});
