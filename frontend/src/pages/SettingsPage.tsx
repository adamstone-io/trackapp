import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  CURRENT_USER_KEY,
  fetchCurrentUser,
  patchAccount,
  type CurrentUser,
} from "../api/auth";
import { endSession } from "../auth/session";
import { Field } from "../components/Field";
import { PageShell } from "../components/PageShell";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { data: user } = useQuery({ queryKey: CURRENT_USER_KEY, queryFn: fetchCurrentUser });

  return (
    <PageShell>
      {user && (
        <>
          {/* Keyed by account, so the form seeds itself once from the server. */}
          <AccountForm key={user.id} user={user} />
          <PasswordForm />
          <SubscriptionSection user={user} />
        </>
      )}
      <SignOut />
    </PageShell>
  );
}

function AccountForm({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      patchAccount({ first_name: firstName, last_name: lastName, email: email.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(CURRENT_USER_KEY, updated);
      setSaved(true);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    mutation.mutate();
  }

  return (
    <Section title="Account">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <Field id="first-name" label="First name" value={firstName} onChange={setFirstName} />
          <Field id="last-name" label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required />
        <p className={styles.fixed}>
          Username <span className={styles.fixedValue}>{user.username}</span>
          <span className={styles.note}>— what you log in with, and it can't be changed</span>
        </p>
        <Outcome error={mutation.error} done={saved} doneMessage="Account saved." />
        <button type="submit" className={styles.action} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save account"}
        </button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      // The backend revokes every refresh token on a change, so this session
      // is already dead; staying signed in would only delay the discovery.
      endSession(queryClient);
      navigate("/login", {
        replace: true,
        state: { notice: "Password changed. Please log in again." },
      });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Section title="Password">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <Field
            id="current-password"
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required
          />
          <Field
            id="new-password"
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
          />
        </div>
        <p className={styles.message}>
          Changing your password signs you out everywhere, this tab included.
        </p>
        <Outcome error={mutation.error} />
        <button type="submit" className={styles.action} disabled={mutation.isPending}>
          {mutation.isPending ? "Changing…" : "Change password"}
        </button>
      </form>
    </Section>
  );
}

function SubscriptionSection({ user }: { user: CurrentUser }) {
  const { is_subscribed, is_grandfathered, trial_days_remaining } = user.subscription;

  return (
    <Section title="Subscription">
      <p className={styles.message}>{describeAccess()}</p>
    </Section>
  );

  function describeAccess(): string {
    if (is_subscribed) return "Subscribed.";
    if (is_grandfathered) return "Permanent access.";
    if (trial_days_remaining === null) return "No trial running.";
    if (trial_days_remaining === 1) return "1 day left on your trial.";
    return `${trial_days_remaining} days left on your trial.`;
  }
}

function SignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <Section title="Session">
      <button
        type="button"
        className={styles.action}
        onClick={() => {
          endSession(queryClient);
          navigate("/login", { replace: true });
        }}
      >
        Log out
      </button>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = `settings-${title.toLowerCase()}`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Outcome({
  error,
  done = false,
  doneMessage = "",
}: {
  error: unknown;
  done?: boolean;
  doneMessage?: string;
}) {
  if (error) {
    return (
      <p className={styles.error}>
        {error instanceof Error ? error.message : "That didn't work. Try again."}
      </p>
    );
  }
  return done ? <p className={styles.done}>{doneMessage}</p> : null;
}
