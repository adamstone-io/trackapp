const uiCache = new Map();

function byId(id) {
  const cached = uiCache.get(id);
  if (cached && cached.isConnected) return cached;

  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);

  uiCache.set(id, el);
  return el;
}

function on(el, type, handler, options) {
  el.addEventListener(type, handler, options);
  const off = () => el.removeEventListener(type, handler, options);
  if (options && options.signal)
    options.signal.addEventListener("abort", off, { once: true });
  return off;
}

let HIDE_CLASS = "hidden";
function show(el) {
  el.classList.remove(HIDE_CLASS);
}
function hide(el) {
  el.classList.add(HIDE_CLASS);
}
function toggle(el, force) {
  el.classList.toggle(HIDE_CLASS);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export { byId, on, show, hide, toggle, formatTime };
