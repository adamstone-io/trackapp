/** Detect trial-expired API errors (403 from HasAppAccess / TrialExpired). */

const TRIAL_EXPIRED_PAGE = "trial-expired.html";

export function trialExpiredFromJson(data) {
  if (!data || typeof data !== "object") return false;
  if (data.code === "trial_expired") return true;
  const d = data.detail;
  if (d && typeof d === "object" && d.code === "trial_expired") return true;
  if (typeof d === "string" && d.toLowerCase().includes("free trial has ended")) return true;
  return false;
}

export function redirectToTrialExpired() {
  if (window.location.pathname.endsWith(`/${TRIAL_EXPIRED_PAGE}`)) return;
  window.location.href = TRIAL_EXPIRED_PAGE;
}

/** @returns {boolean} true if redirected */
export function handleTrialExpiredBody(textBody) {
  try {
    const data = JSON.parse(textBody);
    if (trialExpiredFromJson(data)) {
      redirectToTrialExpired();
      return true;
    }
  } catch {
    if (typeof textBody === "string" && textBody.toLowerCase().includes("free trial has ended")) {
      redirectToTrialExpired();
      return true;
    }
  }
  return false;
}
