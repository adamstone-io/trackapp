function nowMs() {
  return Date.now();
}

// Format seconds as HH:MM:SS
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Format seconds as a human-readable duration label.
// < 60s  → "X seconds"
// < 1h   → "X minutes"
// >= 1h  → "X hour(s) Y minutes" (omits minutes when 0)
function formatDurationLabel(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) {
    return `${s} second${s === 1 ? "" : "s"}`;
  }
  const totalMinutes = Math.round(s / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes === 0) return hourLabel;
  return `${hourLabel} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export { nowMs, formatTime, formatDurationLabel, nowSec };
