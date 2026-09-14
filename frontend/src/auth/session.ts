import type { QueryClient } from "@tanstack/react-query";
import { clearTokens } from "./tokens";
import { clearDurationFavorites } from "../lib/durationFavorites";

/**
 * End the session completely. Tokens, the server-state cache, and the
 * localStorage preferences all belong to the account that is leaving — on a
 * shared browser the next person to log in must not inherit any of them.
 */
export function endSession(queryClient: QueryClient): void {
  clearTokens();
  clearDurationFavorites();
  queryClient.clear();
}
