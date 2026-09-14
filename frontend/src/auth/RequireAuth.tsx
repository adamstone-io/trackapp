import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AuthExpiredError, TrialExpiredError } from "../api/client";
import { CURRENT_USER_KEY, fetchCurrentUser } from "../api/auth";
import { isAuthenticated } from "./tokens";
import styles from "../pages/AuthPages.module.css";

/**
 * Gates the authenticated app shell: unauthenticated visitors go to /login
 * (with a `next` param back to where they were), users without app access go
 * to /trial-expired.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const authed = isAuthenticated();

  const userQuery = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    enabled: authed,
  });

  const loginUrl = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  if (!authed) {
    return <Navigate to={loginUrl} replace />;
  }

  if (userQuery.error) {
    if (userQuery.error instanceof TrialExpiredError) {
      return <Navigate to="/trial-expired" replace />;
    }
    if (userQuery.error instanceof AuthExpiredError) {
      return <Navigate to={loginUrl} replace />;
    }
    return (
      <main className={styles.page}>
        <div className={styles.card} role="alert">
          <p className={styles.message}>
            We couldn't load your account. Check your connection and try again.
          </p>
        </div>
      </main>
    );
  }

  if (!userQuery.data) return null;

  if (!userQuery.data.subscription.has_app_access) {
    return <Navigate to="/trial-expired" replace />;
  }

  return <>{children}</>;
}
