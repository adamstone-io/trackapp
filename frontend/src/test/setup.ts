import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";
import { installIntersectionObserver } from "./intersection";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => installIntersectionObserver());

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
