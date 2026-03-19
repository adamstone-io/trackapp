import { verifyEmail } from "./api/authApi.js";

async function init() {
  const titleEl = document.getElementById("verify-title");
  const messageEl = document.getElementById("verify-message");
  const actionsEl = document.getElementById("verify-actions");

  const token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    titleEl.textContent = "Invalid Link";
    messageEl.textContent = "No verification token found. Please use the link from your email.";
    actionsEl.style.display = "block";
    return;
  }

  try {
    const data = await verifyEmail(token);
    titleEl.textContent = "Email Verified";
    messageEl.textContent = data.detail || "Your email has been verified. You can now log in.";
  } catch (err) {
    titleEl.textContent = "Verification Failed";
    messageEl.textContent =
      err.message?.includes("400")
        ? "This link is invalid or has already been used."
        : "Something went wrong. Please try again or request a new link.";
  } finally {
    actionsEl.style.display = "block";
  }
}

init();
