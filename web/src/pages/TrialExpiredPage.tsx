import styles from "./AuthPages.module.css";

export function TrialExpiredPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Your trial has ended</h1>
        <p className={styles.message}>
          Thanks for trying TempoTrack. Your data is safe — get in touch to keep
          tracking your time, habits, and study flow.
        </p>
        <a className={styles.primaryAction} href="mailto:hello@tempotrack.app">
          Contact us
        </a>
      </div>
    </main>
  );
}
