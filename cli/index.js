#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CRED_DIR = path.join(require('os').homedir(), '.trackapp');
const CONFIG_FILE = path.join(CRED_DIR, 'config.json');
const CRED_FILE = path.join(CRED_DIR, 'credentials.json');
const PRESETS_FILE = path.join(CRED_DIR, 'presets.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const API_BASE = (loadConfig().api_url || process.env.TRACKAPP_API || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveCredentials(creds) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
  fs.writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function clearCredentials() {
  try { fs.unlinkSync(CRED_FILE); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------

function loadPresets() {
  try {
    return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function savePresets(presets) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function request(method, endpoint, body, accessToken) {
  const url = `${API_BASE}/api${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const text = await res.text();
  if (!text || text === 'null' || text === 'None') return null;
  return JSON.parse(text);
}

async function refreshAccessToken(creds) {
  const data = await request('POST', '/auth/token/refresh/', { refresh: creds.refresh });
  creds.access = data.access;
  if (data.refresh) creds.refresh = data.refresh;
  saveCredentials(creds);
  return creds;
}

async function api(method, endpoint, body) {
  const creds = loadCredentials();
  if (!creds) {
    console.error('Not logged in. Run: track login');
    process.exit(1);
  }

  try {
    return await request(method, endpoint, body, creds.access);
  } catch (err) {
    if (err.status === 401) {
      try {
        const refreshed = await refreshAccessToken(creds);
        return await request(method, endpoint, body, refreshed.access);
      } catch {
        console.error('Session expired. Run: track login');
        clearCredentials();
        process.exit(1);
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Input helper
// ---------------------------------------------------------------------------

function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();

      let input = '';
      const onData = (ch) => {
        const c = ch.toString();
        if (c === '\n' || c === '\r') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.removeListener('data', onData);
          stdin.pause();
          process.stdout.write('\n');
          resolve(input);
        } else if (c === '\u0003') {
          process.exit();
        } else if (c === '\u007f' || c === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function currentElapsed(timer) {
  if (timer.is_paused) return timer.elapsed_seconds;
  const startMs = new Date(timer.started_at).getTime();
  const nowMs = Date.now();
  return timer.elapsed_seconds + Math.floor((nowMs - startMs) / 1000);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdLogin() {
  const username = await prompt('Username: ');
  const password = await prompt('Password: ', true);

  try {
    const data = await request('POST', '/auth/token/', { username, password });
    saveCredentials({ access: data.access, refresh: data.refresh, username });
    console.log(`Logged in as ${username}.`);
  } catch (err) {
    console.error('Login failed:', err.status === 401 ? 'invalid credentials.' : err.message);
    process.exit(1);
  }
}

async function cmdLogout() {
  clearCredentials();
  console.log('Logged out.');
}

async function cmdStart(...args) {
  let mode = 'stopwatch';
  let targetDuration = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-cd') {
      mode = 'countdown';
      const minutes = parseInt(args[++i], 10);
      if (!minutes || minutes <= 0) {
        console.error('Usage: track start "Task name" -cd <minutes>');
        process.exit(1);
      }
      targetDuration = minutes * 60;
    } else {
      positional.push(args[i]);
    }
  }

  const taskTitle = positional[0] || 'Untitled';

  // Check for existing timer
  const existing = await api('GET', '/active-timer/');
  if (existing) {
    const elapsed = currentElapsed(existing);
    console.error(`Timer already running: "${existing.task_title}" (${formatDuration(elapsed)})`);
    console.error('Stop it first with: track stop');
    process.exit(1);
  }

  const timer = await api('POST', '/active-timer/', {
    task_title: taskTitle,
    started_at: new Date().toISOString(),
    elapsed_seconds: 0,
    is_paused: false,
    mode,
    target_duration: targetDuration,
  });

  const msg = mode === 'countdown'
    ? `Started countdown: "${timer.task_title}" — ${formatDuration(targetDuration)}`
    : `Started: "${timer.task_title}"`;
  console.log(msg);
}

async function ensureTask(title) {
  const data = await api('GET', '/tasks/');
  const tasks = Array.isArray(data) ? data : (data.results || []);
  const existing = tasks.find((t) => t.title === title && !t.archived);
  if (existing) return existing.id;

  const created = await api('POST', '/tasks/', { title, category: 'other' });
  return created.id;
}

async function cmdStop() {
  const timer = await api('GET', '/active-timer/');
  if (!timer) {
    console.log('No active timer.');
    return;
  }

  const elapsed = currentElapsed(timer);
  const endedAt = new Date().toISOString();

  // Create a time entry before deleting the timer
  const taskId = timer.task || await ensureTask(timer.task_title);
  await api('POST', '/time-entries/', {
    task: taskId,
    task_title: timer.task_title,
    started_at: timer.started_at,
    ended_at: endedAt,
    duration_seconds: elapsed,
    notes: '',
    breaks: [],
  });

  await api('DELETE', '/active-timer/');
  console.log(`Stopped: "${timer.task_title}" — ${formatDuration(elapsed)}`);
}

async function cmdPause() {
  const timer = await api('GET', '/active-timer/');
  if (!timer) { console.log('No active timer.'); return; }
  if (timer.is_paused) { console.log(`Already paused: "${timer.task_title}"`); return; }

  const elapsed = currentElapsed(timer);
  await api('PATCH', '/active-timer/', { is_paused: true, elapsed_seconds: elapsed });
  console.log(`Paused: "${timer.task_title}" at ${formatDuration(elapsed)}`);
}

async function cmdResume() {
  const timer = await api('GET', '/active-timer/');
  if (!timer) { console.log('No active timer.'); return; }
  if (!timer.is_paused) { console.log(`Already running: "${timer.task_title}"`); return; }

  await api('PATCH', '/active-timer/', {
    is_paused: false,
    started_at: new Date().toISOString(),
  });
  console.log(`Resumed: "${timer.task_title}" (${formatDuration(timer.elapsed_seconds)} elapsed)`);
}

async function cmdStatus() {
  const timer = await api('GET', '/active-timer/');
  if (!timer) { console.log('No active timer.'); return; }

  const elapsed = currentElapsed(timer);
  const state = timer.is_paused ? 'paused' : 'running';
  console.log(`"${timer.task_title}" — ${formatDuration(elapsed)} (${state})`);
}

async function cmdPreset(action, ...args) {
  if (action === 'add') {
    const name = args[0];
    if (!name) {
      console.error('Usage: track preset add <name> "Task title" [-cd <minutes>]');
      process.exit(1);
    }

    // Parse remaining args the same way as cmdStart
    let mode = 'stopwatch';
    let minutes = null;
    const positional = [];

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '-cd') {
        mode = 'countdown';
        minutes = parseInt(args[++i], 10);
        if (!minutes || minutes <= 0) {
          console.error('Minutes must be a positive number.');
          process.exit(1);
        }
      } else {
        positional.push(args[i]);
      }
    }

    const taskTitle = positional[0];
    if (!taskTitle) {
      console.error('Usage: track preset add <name> "Task title" [-cd <minutes>]');
      process.exit(1);
    }

    const presets = loadPresets();
    presets[name] = { task_title: taskTitle, mode, minutes };
    savePresets(presets);
    const desc = mode === 'countdown' ? `"${taskTitle}" countdown ${minutes}m` : `"${taskTitle}" stopwatch`;
    console.log(`Preset "${name}" saved: ${desc}`);

  } else if (action === 'remove') {
    const name = args[0];
    if (!name) {
      console.error('Usage: track preset remove <name>');
      process.exit(1);
    }
    const presets = loadPresets();
    if (!presets[name]) {
      console.error(`Preset "${name}" not found.`);
      process.exit(1);
    }
    delete presets[name];
    savePresets(presets);
    console.log(`Preset "${name}" removed.`);

  } else if (action === 'list' || !action) {
    const presets = loadPresets();
    const entries = Object.entries(presets);
    if (entries.length === 0) {
      console.log('No presets saved. Add one with: track preset add <name> "Task title" [-cd <minutes>]');
      return;
    }
    for (const [name, p] of entries) {
      const desc = p.mode === 'countdown' ? `${p.minutes}m countdown` : 'stopwatch';
      console.log(`  ${name} — "${p.task_title}" (${desc})`);
    }

  } else {
    console.error('Usage: track preset <add|remove|list>');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const COMMANDS = {
  login:  { fn: cmdLogin,  usage: 'track login' },
  logout: { fn: cmdLogout, usage: 'track logout' },
  start:  { fn: cmdStart,  usage: 'track start "Task name" [-cd <minutes>]' },
  stop:   { fn: cmdStop,   usage: 'track stop' },
  pause:  { fn: cmdPause,  usage: 'track pause' },
  resume: { fn: cmdResume, usage: 'track resume' },
  status: { fn: cmdStatus, usage: 'track status' },
  preset: { fn: cmdPreset, usage: 'track preset <add|remove|list>' },
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('Usage: track <command>\n');
    console.log('Commands:');
    for (const [name, { usage }] of Object.entries(COMMANDS)) {
      console.log(`  ${usage}`);
    }
    console.log(`\nAPI: ${API_BASE} (override with TRACKAPP_API env var)`);
    return;
  }

  const command = COMMANDS[cmd];
  if (!command) {
    // Check if it's a preset name
    const presets = loadPresets();
    if (presets[cmd]) {
      const p = presets[cmd];
      const presetArgs = [p.task_title];
      if (p.mode === 'countdown' && p.minutes) {
        presetArgs.push('-cd', String(p.minutes));
      }
      try {
        await cmdStart(...presetArgs);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        if (err.body) console.error(err.body);
        process.exit(1);
      }
      return;
    }
    console.error(`Unknown command: ${cmd}. Run "track help" for usage.`);
    process.exit(1);
  }

  try {
    await command.fn(...args);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.body) console.error(err.body);
    process.exit(1);
  }
}

main();
