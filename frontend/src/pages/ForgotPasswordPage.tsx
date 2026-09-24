import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";
import styles from "./AuthPages.module.css";

/**
 * The way back in for someone who cannot supply their current password.
 *
 * The answer never says whether the address was on an account — the endpoint
 * is reachable without logging in, and a specific answer would make this a
 * way to ask who has one.
 */
export function ForgotPasswordPage() {
  const location = useLocation();
  const loginEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(loginEmail);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setSent(response.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <p className={styles.message}>{sent}</p>
            <p className={styles.message}>The link is good for one hour.</p>
            <Link to="/login" className={styles.primaryAction}>
              Back to log in
            </Link>
          </>
        ) : (
          <>
            <p className={styles.message}>
              Enter the email on your account and we'll send you a link to
              choose a new password.
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.primaryAction} disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className={styles.message}>
              <Link to="/login">Back to log in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
