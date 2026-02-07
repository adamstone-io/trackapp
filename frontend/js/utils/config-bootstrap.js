const isLocal =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(location.hostname) ||
  location.hostname.endsWith(".local") ||
  location.hostname.endsWith(".localhost");

if (!isLocal) {
  const s = document.createElement("script");
  s.src = "/html/config.js";
  document.head.appendChild(s);
} else {
  window.APP_CONFIG = window.APP_CONFIG || {};
}

const apiOrigin = window.APP_CONFIG?.API_ORIGIN;
if (apiOrigin) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = apiOrigin;
  document.head.appendChild(link);
}
