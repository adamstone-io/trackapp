import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { register } from "../api/auth";
import { Field } from "../components/Field";
import styles from "./AuthPages.module.css";

export function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        registration_code: registrationCode.trim(),
      });
      setCreated(response.detail);
    } catch (err) {
      // The form keeps its values: a rejected invite code or a taken username
      // is one field to fix, not a reason to retype everything.
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Check your email</h1>
          <p className={styles.message}>{created}</p>
          <p className={styles.hint}>
            The link in that email activates your account. Nothing arrived?{" "}
            <Link to="/verify-email">Send it again</Link>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Sign up</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Field
            id="signup-username"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            required
          />
          <Field
            id="signup-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <Field
            id="signup-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
          />
          <Field
            id="signup-code"
            label="Invite code"
            value={registrationCode}
            onChange={setRegistrationCode}
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primaryAction} disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className={styles.hint}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
