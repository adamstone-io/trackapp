/*
 * JWT storage. Keys match the legacy vanilla-JS frontend so an existing
 * session carries over when a user first loads the React app.
 */

const KEYS = {
  access: "authAccessToken",
  refresh: "authRefreshToken",
  username: "authUsername",
} as const;

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.refresh);
}

export function setTokens({ access, refresh }: { access?: string; refresh?: string }): void {
  if (access) {
    localStorage.setItem(KEYS.access, access);
    const username = usernameFromJwt(access);
    if (username) localStorage.setItem(KEYS.username, username);
  }
  if (refresh) {
    localStorage.setItem(KEYS.refresh, refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.username);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

function usernameFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.username || payload.user || payload.sub || null;
  } catch {
    return null;
  }
}
