import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { API_BASE } from "../api/config";

export const api = (path: string) => `${API_BASE}${path}`;

/** A user with an active trial — the default happy path. */
export const activeUser = {
  id: 1,
  username: "adam",
  email: "adam@example.com",
  subscription: {
    is_grandfathered: false,
    is_subscribed: false,
    trial_ends_at: "2099-01-01T00:00:00Z",
    trial_days_remaining: 30,
    has_app_access: true,
  },
};

export const defaultHandlers = [
  http.get(api("/auth/user/"), () => HttpResponse.json(activeUser)),
  http.get(api("/today-entries/"), () => HttpResponse.json([])),
  http.get(api("/active-timer/"), () => HttpResponse.json(null)),
  // The timer's project picker asks for these on every render of the page.
  http.get(api("/projects/"), () =>
    HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
  ),
];

export const server = setupServer(...defaultHandlers);

export { http, HttpResponse };
