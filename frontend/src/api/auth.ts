import { apiFetch, getUnauthenticated, postUnauthenticated } from "./client";
import { setTokens } from "../auth/tokens";

interface TokenPair {
  access: string;
  refresh: string;
}

export interface Subscription {
  is_grandfathered: boolean;
  is_subscribed: boolean;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  has_app_access: boolean;
}

export interface CurrentUser {
  id: number;
  /** The login identifier; the API refuses to change it. */
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  subscription: Subscription;
}

/** The account query key. RequireAuth and the settings page share it, so
 * saving the account updates both. */
export const CURRENT_USER_KEY = ["auth", "user"];

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/user/");
}

export function verifyEmail(token: string): Promise<{ detail: string }> {
  return getUnauthenticated<{ detail: string }>(
    `/auth/verify-email/?token=${encodeURIComponent(token)}`,
  );
}

export function resendVerification(email: string): Promise<{ detail: string }> {
  return postUnauthenticated<{ detail: string }>("/auth/resend-verification/", {
    email,
  });
}

export async function login(username: string, password: string): Promise<void> {
  const tokens = await postUnauthenticated<TokenPair>("/auth/token/", {
    username,
    password,
  });
  setTokens(tokens);
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  /** Registration is gated; the backend checks this against REGISTRATION_CODE. */
  registration_code: string;
}

export function register(payload: RegisterRequest): Promise<{ detail: string }> {
  return postUnauthenticated<{ detail: string }>("/auth/register/", payload);
}

/** Settings edits names and email; a field left out is left alone. */
export type AccountPatch = Partial<Pick<CurrentUser, "first_name" | "last_name" | "email">>;

export function patchAccount(patch: AccountPatch): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/user/", { method: "PATCH", body: patch });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>("/auth/password/", {
    method: "PATCH",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
