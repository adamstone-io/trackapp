import { loginUser, registerUser } from "../api/authApi.js";

export function createLoginController() {
  const form = document.getElementById("auth-form");
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const registrationCodeInput = document.getElementById("auth-registration-code");
  const registrationCodeGroup = document.getElementById("auth-registration-code-group");
  const submitBtn = document.getElementById("auth-submit");
  const toggleBtn = document.getElementById("auth-toggle");
  const messageEl = document.getElementById("auth-message");

  let mode = "login";

  function setMessage(text) {
    if (messageEl) {
      messageEl.textContent = text;
    }
  }

  function updateMode(nextMode) {
    mode = nextMode;
    if (mode === "login") {
      submitBtn.textContent = "Log In";
      if (registrationCodeGroup) {
        registrationCodeGroup.classList.add("hidden");
      }
      if (registrationCodeInput) {
        registrationCodeInput.required = false;
        registrationCodeInput.value = "";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Need an account? Register";
      }
      setMessage("Log in to access your data.");
    } else {
      submitBtn.textContent = "Register";
      if (registrationCodeGroup) {
        registrationCodeGroup.classList.remove("hidden");
      }
      if (registrationCodeInput) {
        registrationCodeInput.required = true;
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Have an account? Log In";
      }
      setMessage("Enter the registration code to create an account.");
    }
  }

  function getNextPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next) return "timer.html";
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const registrationCode = registrationCodeInput?.value.trim();

    if (!username || !password) {
      setMessage("Enter both username and password.");
      return;
    }
    if (mode === "register" && !registrationCode) {
      setMessage("Registration code is required.");
      return;
    }

    submitBtn.disabled = true;
    try {
      if (mode === "register") {
        await registerUser({ username, password, registrationCode });
      }
      await loginUser({ username, password });
      window.location.href = getNextPath();
    } catch (error) {
      console.error("Auth failed:", error);
      setMessage(error.message || "Authentication failed.");
    } finally {
      submitBtn.disabled = false;
    }
  }

  function handleToggle() {
    updateMode(mode === "login" ? "register" : "login");
  }

  // Initialize
  updateMode("login");
  form.addEventListener("submit", handleSubmit);
  if (toggleBtn) {
    toggleBtn.addEventListener("click", handleToggle);
  }

  // Return cleanup function (optional)
  return () => {
    form.removeEventListener("submit", handleSubmit);
    if (toggleBtn) {
      toggleBtn.removeEventListener("click", handleToggle);
    }
  };
}
