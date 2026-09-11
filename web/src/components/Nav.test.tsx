import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, seedSession } from "../test/render";

const PAGES = [
  ["Dashboard", "/"],
  ["Timer", "/timer"],
  ["Workspace", "/workspace"],
  ["Calendar", "/calendar"],
  ["Study", "/study"],
  ["Habits", "/habits"],
  ["Moments", "/moments"],
  ["Stats", "/stats"],
  ["Settings", "/settings"],
] as const;

describe("navigation", () => {
  it("links to every page and marks the active one", async () => {
    seedSession();
    renderApp("/");

    await screen.findByRole("heading", { name: "Dashboard" });

    const nav = screen.getByRole("navigation", { name: /main/i });
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

    expect(
      await screen.findByRole("heading", { name: "Habits" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Habits" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders every route as a titled shell", async () => {
    seedSession();

    for (const [label, path] of PAGES) {
      const { unmount } = renderApp(path);
      expect(
        await screen.findByRole("heading", { name: label }),
      ).toBeInTheDocument();
      unmount();
    }
  });
});
