import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import styles from "./AuthPages.module.css";

/**
 * Where the emailed link lands: choose the new password, then log in with it.
 *
 * Reports inline and waits for the server, like the other auth forms — there
 * is nothing to apply optimistically, and the server owns whether the
 * password is strong enough and whether the link is still good.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Checked here because the server is only ever sent one password, and
    // "you typed two different things" is not a question for it.
    if (password !== confirmation) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await resetPassword(token, password);
      setDone(response.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Choose a new password</h1>
        {!token ? (
          <>
            <p className={styles.error}>
              That link is missing its token. Request a new one.
            </p>
            <Link to="/forgot-password" className={styles.primaryAction}>
              Request a new link
            </Link>
          </>
        ) : done ? (
          <>
            <p className={styles.message}>{done}</p>
            <Link to="/login" className={styles.primaryAction}>
              Log in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                className={styles.input}
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.primaryAction} disabled={submitting}>
              {submitting ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
