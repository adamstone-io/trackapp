import { API_BASE } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "../auth/tokens";

export class ApiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The user's trial has ended (403 with code "trial_expired"). */
export class TrialExpiredError extends Error {
  constructor() {
    super("Your free trial has ended.");
    this.name = "TrialExpiredError";
  }
}

/** Authentication failed and could not be recovered by a token refresh. */
export class AuthExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please log in again.");
    this.name = "AuthExpiredError";
  }
}

function isTrialExpiredBody(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (record.code === "trial_expired") return true;
  const detail = record.detail;
  if (detail && typeof detail === "object" && (detail as Record<string, unknown>).code === "trial_expired") {
    return true;
  }
  return typeof detail === "string" && detail.toLowerCase().includes("free trial has ended");
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
}

/**
 * Authenticated fetch against the TrackApp API. Attaches the JWT and the
 * user's timezone (required by stats/habit endpoints for day boundaries).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await requestWithAuth(path, options);
  return unwrap<T>(response);
}

async function requestWithAuth(path: string, options: ApiFetchOptions): Promise<Response> {
  const response = await doFetch(path, options, getAccessToken());
  if (response.status !== 401) return response;

  const freshAccess = await refreshAccessToken();
  const retried = await doFetch(path, options, freshAccess);
  if (retried.status === 401) {
    // The backend rejects even a freshly refreshed token — give up on the session.
    clearTokens();
    throw new AuthExpiredError();
  }
  return retried;
}

// Single-flight: concurrent 401s share one refresh request.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    throw new AuthExpiredError();
  }

  const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearTokens();
    throw new AuthExpiredError();
  }

  const data = (await response.json()) as { access: string; refresh?: string };
  setTokens(data);
  return data.access;
}

function doFetch(path: string, options: ApiFetchOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "x-user-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // FormData sets its own multipart Content-Type (with boundary).
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  return fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
}

export interface PaginatedPage<T> {
  next: string | null;
  results: T[];
}

/** Walk a DRF-paginated list endpoint (default page size 20) to completion. */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const data = await apiFetch<PaginatedPage<T>>(`${path}?page=${page}`);
    items.push(...data.results);
    if (!data.next) return items;
  }
}

/** Pull a human-readable message out of a DRF error body. */
export function detailFromBody(data: unknown): string {
  if (data && typeof data === "object") {
    const detail = (data as Record<string, unknown>).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && typeof detail[0] === "string") return detail[0];
    if (detail && typeof detail === "object") {
      const nested = (detail as Record<string, unknown>).detail;
      if (typeof nested === "string") return nested;
    }
  }
  return "Something went wrong. Please try again.";
}

export async function postUnauthenticated<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(response);
}

export async function getUnauthenticated<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  return unwrap<T>(response);
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 && isTrialExpiredBody(data)) {
      throw new TrialExpiredError();
    }
    throw new ApiError(response.status, detailFromBody(data));
  }
  return data as T;
}
