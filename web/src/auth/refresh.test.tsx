import { screen } from "@testing-library/react";
import { renderApp, seedSession, fakeJwt } from "../test/render";
import { server, api, http, HttpResponse, activeUser } from "../test/server";
import { getAccessToken, getRefreshToken } from "./tokens";

describe("token refresh", () => {
  it("refreshes the access token on a 401 and retries the request", async () => {
    seedSession();
    const freshAccess = fakeJwt({ username: "adam", fresh: true });
    const authHeaders: (string | null)[] = [];
    let refreshedWith: Record<string, string> | null = null;

    server.use(
      http.get(api("/auth/user/"), ({ request }) => {
        const auth = request.headers.get("Authorization");
        authHeaders.push(auth);
        if (auth === `Bearer ${freshAccess}`) {
          return HttpResponse.json(activeUser);
        }
        return HttpResponse.json({ detail: "Token is expired" }, { status: 401 });
      }),
      http.post(api("/auth/token/refresh/"), async ({ request }) => {
        refreshedWith = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ access: freshAccess });
      }),
    );

    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: "Timer" }),
    ).toBeInTheDocument();
    expect(refreshedWith).toEqual({ refresh: getRefreshToken() });
    expect(authHeaders).toHaveLength(2);
    expect(authHeaders[1]).toBe(`Bearer ${freshAccess}`);
    expect(getAccessToken()).toBe(freshAccess);
  });

  it("treats a 401 after a successful refresh as an expired session", async () => {
    seedSession();
    server.use(
      http.get(api("/auth/user/"), () =>
        HttpResponse.json({ detail: "Token is expired" }, { status: 401 }),
      ),
      http.post(api("/auth/token/refresh/"), () =>
        HttpResponse.json({ access: fakeJwt({ username: "adam" }) }),
      ),
    );

    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it("clears the session and redirects to login when refresh fails", async () => {
    seedSession();
    server.use(
      http.get(api("/auth/user/"), () =>
        HttpResponse.json({ detail: "Token is expired" }, { status: 401 }),
      ),
      http.post(api("/auth/token/refresh/"), () =>
        HttpResponse.json({ detail: "Token is invalid or expired" }, { status: 401 }),
      ),
    );

    renderApp("/timer");

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
