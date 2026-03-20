import { clearAuthTokens, refreshAccessToken } from "./authApi.js";
import { handleTrialExpiredBody } from "../utils/trial.js";

const LOGIN_PAGE = "login.html";

function isLoginPage() {
  return window.location.pathname.endsWith(`/${LOGIN_PAGE}`);
}

function redirectToLogin() {
  if (isLoginPage()) return;
  const next = encodeURIComponent(window.location.pathname.split("/").pop());
  window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

export async function http(
  url,
  { method = "GET", headers = {}, body } = {},
  { skipAuth = false, retry = true } = {},
) {
  const token = localStorage.getItem("authAccessToken");

  const response = await fetch(url, {
    method,
    headers: {
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body,
  });

  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return http(
        url,
        { method, headers, body },
        { skipAuth, retry: false },
      );
    }
    clearAuthTokens();
    redirectToLogin();
    throw new Error("Authentication required");
  }

  if (response.status === 403) {
    const errorText = await response.text();
    if (handleTrialExpiredBody(errorText)) {
      throw new Error("trial_expired");
    }
    throw new Error(`API 403: ${errorText}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export function json(
  url,
  { method = "GET", body, headers = {} } = {},
  config = {},
) {
  return http(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }, config);
}
