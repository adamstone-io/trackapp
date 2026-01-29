import { loginUser, registerUser } from "./data/storage.js";

const form = document.getElementById("auth-form");
const usernameInput = document.getElementById("auth-username");
const passwordInput = document.getElementById("auth-password");
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
    if (toggleBtn) {
      toggleBtn.textContent = "Need an account? Register";
    }
    setMessage("Log in to access your data.");
  } else {
    submitBtn.textContent = "Register";
    if (toggleBtn) {
      toggleBtn.textContent = "Have an account? Log In";
    }
    setMessage("Create a new account to get started.");
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

  if (!username || !password) {
    setMessage("Enter both username and password.");
    return;
  }

  submitBtn.disabled = true;
  try {
    if (mode === "register") {
      await registerUser({ username, password });
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

updateMode("login");

form.addEventListener("submit", handleSubmit);
if (toggleBtn) {
  toggleBtn.addEventListener("click", handleToggle);
}
