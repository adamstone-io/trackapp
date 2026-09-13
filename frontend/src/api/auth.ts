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
  username: string;
  email: string;
  subscription: Subscription;
}

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
