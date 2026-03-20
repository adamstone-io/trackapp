import { loginUser, registerUser, resendVerification } from "../api/authApi.js";

export function createLoginController() {
  const form = document.getElementById("auth-form");
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const emailInput = document.getElementById("auth-email");
  const emailGroup = document.getElementById("auth-email-group");
  const registrationCodeInput = document.getElementById("auth-registration-code");
  const registrationCodeGroup = document.getElementById("auth-registration-code-group");
  const submitBtn = document.getElementById("auth-submit");
  const toggleBtn = document.getElementById("auth-toggle");
  const messageEl = document.getElementById("auth-message");
  const titleEl = document.getElementById("auth-title");

  let mode = "login";
  // After register success, hold the email so we can offer a resend link
  let pendingVerificationEmail = null;

  function setMessage(text, { isError = false } = {}) {
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.style.color = isError ? "var(--color-danger, #ef4444)" : "";
    }
  }

  function showResendLink(email) {
    if (!messageEl) return;
    messageEl.innerHTML = "";
    const text = document.createTextNode("Email not verified. ");
    const link = document.createElement("button");
    link.type = "button";
    link.textContent = "Resend verification email";
    link.style.cssText = "background:none;border:none;padding:0;color:var(--color-primary,#6366f1);text-decoration:underline;cursor:pointer;font-size:inherit;";
    link.addEventListener("click", async () => {
      link.disabled = true;
      link.textContent = "Sending...";
      try {
        await resendVerification(email);
        messageEl.textContent = "Verification email sent. Check your inbox.";
      } catch {
        messageEl.textContent = "Could not send email. Try again later.";
      }
    });
    messageEl.appendChild(text);
    messageEl.appendChild(link);
  }

  function updateMode(nextMode) {
    mode = nextMode;
    pendingVerificationEmail = null;

    if (mode === "login") {
      if (titleEl) titleEl.textContent = "Sign in";
      submitBtn.textContent = "Log In";
      if (emailGroup) emailGroup.classList.add("hidden");
      if (emailInput) { emailInput.required = false; emailInput.value = ""; }
      if (registrationCodeGroup) registrationCodeGroup.classList.add("hidden");
      if (registrationCodeInput) {
        registrationCodeInput.required = false;
        registrationCodeInput.value = "";
      }
      if (toggleBtn) toggleBtn.textContent = "Need an account? Register";
      setMessage("Log in to access your data.");
    } else {
      if (titleEl) titleEl.textContent = "Create account";
      submitBtn.textContent = "Create Account";
      if (emailGroup) emailGroup.classList.remove("hidden");
      if (emailInput) emailInput.required = true;
      if (registrationCodeGroup) registrationCodeGroup.classList.remove("hidden");
      if (registrationCodeInput) registrationCodeInput.required = true;
      if (toggleBtn) toggleBtn.textContent = "Have an account? Log In";
      setMessage("Enter the registration code to create an account.");
    }
  }

  function getNextPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    return next || "timer.html";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput?.value.trim() || "";
    const registrationCode = registrationCodeInput?.value.trim() || "";

    if (!username || !password) {
      setMessage("Enter your username and password.", { isError: true });
      return;
    }
    if (mode === "register" && !email) {
      setMessage("Email is required.", { isError: true });
      return;
    }
    if (mode === "register" && !registrationCode) {
      setMessage("Registration code is required.", { isError: true });
      return;
    }

    submitBtn.disabled = true;
    try {
      if (mode === "register") {
        await registerUser({ username, email, password, registrationCode });
        // Don't auto-login — user must verify email first
        pendingVerificationEmail = email;
        setMessage(`Account created! Check ${email} for a verification link.`);
        submitBtn.textContent = "Resend Email";
        submitBtn.disabled = false;
        submitBtn.onclick = async (e) => {
          e.preventDefault();
          submitBtn.disabled = true;
          try {
            await resendVerification(email);
            setMessage("Verification email resent. Check your inbox.");
          } catch {
            setMessage("Could not resend. Try again later.", { isError: true });
          } finally {
            submitBtn.disabled = false;
          }
        };
        return;
      }

      await loginUser({ username, password });
      window.location.href = getNextPath();
    } catch (error) {
      const msg = error.message || "Authentication failed.";
      // Detect unverified email error from backend
      if (msg.toLowerCase().includes("verify your email")) {
        // Try to surface the resend option using the password field username as fallback
        const knownEmail = pendingVerificationEmail || "";
        if (knownEmail) {
          showResendLink(knownEmail);
        } else {
          // Show a resend form prompt
          setMessage(
            "Email not verified. Enter your email below and we'll resend the link.",
            { isError: true }
          );
          if (emailGroup) emailGroup.classList.remove("hidden");
          if (emailInput) emailInput.required = true;
        }
      } else {
        setMessage(msg, { isError: true });
      }
    } finally {
      if (submitBtn.textContent !== "Resend Email") {
        submitBtn.disabled = false;
      }
    }
  }

  function handleToggle() {
    updateMode(mode === "login" ? "register" : "login");
  }

  const initialMode = new URLSearchParams(window.location.search).get("mode") === "register"
    ? "register"
    : "login";
  updateMode(initialMode);
  form.addEventListener("submit", handleSubmit);
  if (toggleBtn) toggleBtn.addEventListener("click", handleToggle);

  return () => {
    form.removeEventListener("submit", handleSubmit);
    if (toggleBtn) toggleBtn.removeEventListener("click", handleToggle);
  };
}
