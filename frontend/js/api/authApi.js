/**
 * Authentication API Layer
 * Handles user authentication, token management, and auth headers
 */

// ========== CONSTANTS ==========

import { API_BASE, API_TIMEOUT } from "./config.js";

const LOGIN_PAGE = `login.html`;

export const AUTH_KEYS = {
  access: "authAccessToken",
  refresh: "authRefreshToken",
  username: "authUsername",
};

// ========== TOKEN MANAGEMENT ==========

export function getAccessToken() {
  return localStorage.getItem(AUTH_KEYS.access);
}

export function getRefreshToken() {
  return localStorage.getItem(AUTH_KEYS.refresh);
}

export function setAuthTokens({ access, refresh } = {}) {
  if (access) {
    localStorage.setItem(AUTH_KEYS.access, access);

    try {
      const payload = JSON.parse(atob(access.split(".")[1]));
      const username = payload.username || payload.user || payload.sub;
      if (username) localStorage.setItem(AUTH_KEYS.username, username);
    } catch (e) {}
  }

  if (refresh) {
    localStorage.setItem(AUTH_KEYS.refresh, refresh);
  }

  scheduleSessionExpiry();
}

export function clearAuthTokens() {
  localStorage.removeItem(AUTH_KEYS.access);
  localStorage.removeItem(AUTH_KEYS.refresh);
  localStorage.removeItem(AUTH_KEYS.username);
  cancelSessionExpiry();
}

export function getUsername() {
  return localStorage.getItem(AUTH_KEYS.username);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

// ========== NAVIGATION ==========

function isLoginPage() {
  return window.location.pathname.endsWith(`/${LOGIN_PAGE}`);
}

function redirectToLogin() {
  if (isLoginPage()) return;
  const next = encodeURIComponent(window.location.pathname.split("/").pop());
  window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

// ========== SESSION EXPIRY TIMER ==========

let _sessionExpiryTimer = null;

export function scheduleSessionExpiry() {
  if (_sessionExpiryTimer) {
    clearTimeout(_sessionExpiryTimer);
    _sessionExpiryTimer = null;
  }

  const refresh = getRefreshToken();
  if (!refresh || isLoginPage()) return;

  try {
    const payload = JSON.parse(atob(refresh.split(".")[1]));
    const msUntilExpiry = payload.exp * 1000 - Date.now();

    if (msUntilExpiry <= 0) {
      clearAuthTokens();
      redirectToLogin();
      return;
    }

    _sessionExpiryTimer = setTimeout(() => {
      clearAuthTokens();
      redirectToLogin();
    }, msUntilExpiry);
  } catch (e) {
    // ignore JWT decode errors
  }

}

export function cancelSessionExpiry() {
  if (_sessionExpiryTimer) {
    clearTimeout(_sessionExpiryTimer);
    _sessionExpiryTimer = null;
  }
}

// ========== REFRESH TOKEN ==========
export async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      clearAuthTokens();
      return false;
    }

    const data = await response.json();
    if (!data?.access) return false;

    setAuthTokens({ access: data.access, refresh: data.refresh ?? refresh });
    return true;
  } catch (e) {
    console.error("Error refreshing access token:", e);
    clearAuthTokens();
    return false;
  }
}

// ========== HEADERS ==========
export function buildAuthHeaders(additionalHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// ========== API REQUESTS ==========

/**
 * Make an authenticated API request with automatic token refresh
 * @param {string} path - API endpoint path (e.g., '/auth/user/')
 * @param {object} options - Fetch options
 * @param {object} config - Request config { skipAuth, retry }
 */
export async function authRequest(path, options = {}, config = {}) {
  const { skipAuth = false, retry = true } = config;
  const { headers: customHeaders, ...restOptions } = options;

  const headers = skipAuth
    ? { "Content-Type": "application/json", ...customHeaders }
    : buildAuthHeaders(customHeaders);

  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers,
  });

  // Handle 401 with token refresh
  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      return authRequest(path, options, { skipAuth, retry: false });
    }
    // Refresh failed - redirect to login
    clearAuthTokens();
    redirectToLogin();
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.status === 204 ? null : response.json();
}

// ========== AUTH ENDPOINTS ==========

export async function registerUser({ username, password, registrationCode }) {
  return authRequest(
    "/auth/register/",
    {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        registration_code: registrationCode,
      }),
    },
    { skipAuth: true, retry: false },
  );
}

export async function loginUser({ username, password }) {
  const data = await authRequest(
    "/auth/token/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { skipAuth: true, retry: false },
  );

  setAuthTokens({ access: data.access, refresh: data.refresh });
  return data;
}

export async function logoutUser() {
  try {
    await authRequest("/auth/logout/", { method: "POST" });
  } catch (error) {
    console.error("Logout request failed:", error);
  } finally {
    clearAuthTokens();
  }
}

export async function getCurrentUser() {
  return authRequest("/auth/user/");
}

export async function ensureAuthenticated() {
  if (isLoginPage()) return true;

  if (getAccessToken()) {
    scheduleSessionExpiry();
    return true;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    redirectToLogin();
    return false;
  }
  return true;
}
