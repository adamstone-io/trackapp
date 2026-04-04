const isLocal =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(location.hostname) ||
  location.hostname.endsWith(".local") ||
  location.hostname.endsWith(".localhost");

if (!isLocal) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/html/config.js", false);
  xhr.send();
  if (xhr.status === 200) {
    new Function(xhr.responseText)();
  }
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
