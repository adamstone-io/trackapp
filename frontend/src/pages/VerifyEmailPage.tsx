import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { resendVerification, verifyEmail } from "../api/auth";
import styles from "./AuthPages.module.css";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Verify your email</h1>
        {token ? <TokenVerification token={token} /> : <ResendForm />}
      </div>
    </main>
  );
}

function TokenVerification({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["auth", "verify-email", token],
    queryFn: () => verifyEmail(token),
    retry: false,
  });

  if (query.isPending) {
    return <p className={styles.message}>Verifying…</p>;
  }

  if (query.error) {
    const message =
      query.error instanceof Error
        ? query.error.message
        : "Verification failed.";
    return (
      <>
        <p className={styles.error}>{message}</p>
        <ResendForm />
      </>
    );
  }

  return (
    <>
      <p className={styles.message}>{query.data.detail}</p>
      <Link to="/login" className={styles.primaryAction}>
        Log in
      </Link>
    </>
  );
}

function ResendForm() {
  const location = useLocation();
  const loginEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(loginEmail);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await resendVerification(email.trim());
      setResult(response.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the link.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <p className={styles.message}>{result}</p>;
  }

  return (
    <>
      <p className={styles.message}>
        Check your inbox for a verification link. Didn't get one? Enter your
        email and we'll resend it.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="resend-email">
            Email
          </label>
          <input
            id="resend-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.primaryAction} disabled={submitting}>
          {submitting ? "Sending…" : "Resend link"}
        </button>
      </form>
    </>
  );
}
