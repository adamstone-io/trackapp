/*
 * API Configuration Layer
 * Detects environment and sets up base API URL
 */

const isLocalFrontend =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.hostname.endsWith(".local");

const apiOrigin = isLocalFrontend
  ? "http://127.0.0.1:8000"
  : window.APP_CONFIG?.API_ORIGIN || "";

if (!apiOrigin) throw new Error("Missing API origin");

export const API_BASE = `${apiOrigin.replace(/\/$/, "")}/api`;

export const IS_LOCAL = isLocalFrontend;

export const API_TIMEOUT = 30000;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
