// A trailing slash on VITE_API_ORIGIN would otherwise produce "//api/...",
// which Django's resolver does not match — a 404 on every request.
const rawOrigin = import.meta.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8000";

export const API_ORIGIN = rawOrigin.replace(/\/+$/, "");

export const API_BASE = `${API_ORIGIN}/api`;
