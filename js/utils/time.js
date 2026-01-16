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

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export { nowMs, formatTime, nowSec };
