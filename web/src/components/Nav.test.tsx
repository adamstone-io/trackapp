import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";

const PAGES = [
  ["Dashboard", "/"],
  ["Timer", "/timer"],
  ["Workspace", "/workspace"],
  ["Calendar", "/calendar"],
  ["Study", "/study"],
  ["Habits", "/habits"],
  ["Stats", "/stats"],
  ["Settings", "/settings"],
] as const;

describe("navigation", () => {
  it("links to every page and marks the active one", async () => {
    seedSession();
    renderApp("/");

    const nav = await screen.findByRole("navigation", { name: /main/i });
    for (const [label] of PAGES) {
      expect(
        screen.getByRole("link", { name: label }),
      ).toBeInTheDocument();
    }
    expect(nav).toContainElement(screen.getByRole("link", { name: "Dashboard" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Habits" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Habits" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the matching nav link current on every route", async () => {
    seedSession();

    // Pages have no h1 — the highlighted nav link is what names the page.
    for (const [label, path] of PAGES) {
      const { unmount } = renderApp(path);
      const link = await screen.findByRole("link", { name: label });
      expect(link).toHaveAttribute("aria-current", "page");
      unmount();
    }
  });
});
