const isLocal =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(location.hostname) ||
  location.hostname.endsWith(".local") ||
  location.hostname.endsWith(".localhost");

if (!isLocal) {
  const s = document.createElement("script");
  s.src = "../html/config.js"; // adjust relative path per page
  document.head.appendChild(s);
} else {
  window.APP_CONFIG = window.APP_CONFIG || {};
}
