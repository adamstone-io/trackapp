import {
  clearAuthTokens,
  deleteCurrentUser,
  getCurrentUser,
  updateCurrentUser,
} from "../api/authApi.js";

function formatTrialLabel(subscription) {
  if (!subscription) return "Unavailable";
  if (subscription.is_grandfathered) return "Legacy access (no trial limit)";
  if (subscription.is_subscribed) return "Active subscription";
  if (subscription.trial_days_remaining == null) return "Trial not started";
  if (subscription.trial_days_remaining <= 0) return "Trial ended";
  const dayLabel = subscription.trial_days_remaining === 1 ? "day" : "days";
  return `${subscription.trial_days_remaining} ${dayLabel} remaining`;
}

function formatTrialEndsAt(subscription) {
  if (!subscription?.trial_ends_at) return "—";
  const date = new Date(subscription.trial_ends_at);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function createSettingsController() {
  const usernameInput = document.getElementById("settings-username");
  const emailInput = document.getElementById("settings-email");
  const trialStatusEl = document.getElementById("settings-trial-status");
  const trialEndsEl = document.getElementById("settings-trial-ends");
  const saveBtn = document.getElementById("settings-save");
  const deleteBtn = document.getElementById("settings-delete-account");
  const messageEl = document.getElementById("settings-message");
  const formEl = document.getElementById("settings-form");

  let currentUser = null;

  function setMessage(text, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.toggle("settings-message--error", isError);
    messageEl.classList.toggle("settings-message--success", !isError);
  }

  function renderUser(user) {
    currentUser = user;
    if (usernameInput) usernameInput.value = user?.username || "";
    if (emailInput) emailInput.value = user?.email || "";

    const subscription = user?.subscription;
    if (trialStatusEl) trialStatusEl.textContent = formatTrialLabel(subscription);
    if (trialEndsEl) trialEndsEl.textContent = formatTrialEndsAt(subscription);
  }

  async function refreshUser() {
    const user = await getCurrentUser();
    renderUser(user);
  }

  async function handleSave(event) {
    event.preventDefault();
    const email = (emailInput?.value || "").trim();
    if (!email) {
      setMessage("Email is required.", true);
      return;
    }

    saveBtn.disabled = true;
    try {
      const updated = await updateCurrentUser({ email });
      renderUser(updated);
      setMessage("Settings updated.");
    } catch (error) {
      setMessage(error.message || "Could not save settings.", true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Delete your account permanently? This cannot be undone."
    );
    if (!ok) return;

    deleteBtn.disabled = true;
    try {
      await deleteCurrentUser();
      clearAuthTokens();
      window.location.href = "index.html";
    } catch (error) {
      setMessage(error.message || "Could not delete account.", true);
      deleteBtn.disabled = false;
    }
  }

  formEl?.addEventListener("submit", handleSave);
  deleteBtn?.addEventListener("click", handleDelete);

  refreshUser().catch((error) => {
    setMessage(error.message || "Could not load settings.", true);
  });

  return () => {
    formEl?.removeEventListener("submit", handleSave);
    deleteBtn?.removeEventListener("click", handleDelete);
  };
}
