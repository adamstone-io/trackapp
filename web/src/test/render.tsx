import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { App } from "../App";
import { setTokens } from "../auth/tokens";

export function renderApp(initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter
      initialEntries={[initialRoute]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App queryClient={queryClient} />
    </MemoryRouter>,
  );
}

/** Seed a logged-in session. Token payloads are irrelevant to MSW handlers. */
export function seedSession() {
  setTokens({
    access: fakeJwt({ username: "adam" }),
    refresh: fakeJwt({ type: "refresh" }),
  });
}

export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => btoa(JSON.stringify(obj));
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}
