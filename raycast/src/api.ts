import fs from "fs";
import path from "path";
import os from "os";

const CRED_DIR = path.join(os.homedir(), ".trackapp");
const CONFIG_FILE = path.join(CRED_DIR, "config.json");
const CRED_FILE = path.join(CRED_DIR, "credentials.json");

function loadConfig(): { api_url?: string } {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function loadCredentials(): { access: string; refresh: string } | null {
  try {
    return JSON.parse(fs.readFileSync(CRED_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCredentials(creds: { access: string; refresh: string }) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
  fs.writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

const API_BASE = (loadConfig().api_url || "http://127.0.0.1:8000").replace(/\/+$/, "");

async function request(method: string, endpoint: string, body?: unknown, accessToken?: string) {
  const url = `${API_BASE}/api${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${text}`);
    (err as any).status = res.status;
    throw err;
  }

  const text = await res.text();
  if (!text || text === "null") return null;
  return JSON.parse(text);
}

async function refreshAccessToken(creds: { access: string; refresh: string }) {
  const data = await request("POST", "/auth/token/refresh/", { refresh: creds.refresh });
  creds.access = data.access;
  if (data.refresh) creds.refresh = data.refresh;
  saveCredentials(creds);
  return creds;
}

export async function api(method: string, endpoint: string, body?: unknown) {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not logged in. Run: track login");

  try {
    return await request(method, endpoint, body, creds.access);
  } catch (err: any) {
    if (err.status === 401) {
      const refreshed = await refreshAccessToken(creds);
      return await request(method, endpoint, body, refreshed.access);
    }
    throw err;
  }
}

export interface StudyItem {
  id: string;
  prompt: string;
  notes: string;
  category: string;
  image_url: string | null;
  note_image_url: string | null;
  is_priming: boolean;
  is_studying: boolean;
  is_reviewing: boolean;
  prime_count: number;
  study_count: number;
  first_primed_at: string | null;
  last_primed_at: string | null;
  first_studied_at: string | null;
  last_studied_at: string | null;
}

export type StudyMode = "priming" | "studying";

export async function fetchNextItem(mode: StudyMode, category?: string): Promise<StudyItem | null> {
  let url = `/study-items/?mode=${mode}&page_size=1&_t=${Date.now()}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  const data = await api("GET", url);
  const results = data?.results || data || [];
  return results[0] || null;
}

export async function fetchCategories(): Promise<string[]> {
  const data = await api("GET", "/study-items/categories/");
  return (data || []).map((c: { category: string }) => c.category);
}

export async function logInteraction(id: string): Promise<void> {
  await api("POST", `/study-items/${id}/log_interaction/`);
}
