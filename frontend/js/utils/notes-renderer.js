/**
 * Renders study/prime/review notes as safe HTML: plain text (escaped) with
 * optional fenced code blocks (``` ... ```). No full markdown.
 */

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeLangClass(lang) {
  const s = (lang || "").trim();
  if (!s) return "";
  if (!/^[\w.+#-]+$/.test(s)) return "";
  return ` language-${escapeHtml(s)}`;
}

/**
 * Plain segment: paragraphs split on blank lines; single newlines become <br>.
 */
function renderPlainSegment(text) {
  if (!text) return "";
  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trimEnd();
      if (!trimmed) return "";
      const withBreaks = escapeHtml(trimmed).replace(/\n/g, "<br />");
      return `<p class="notes-rendered__p">${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * @param {string} raw
 * @returns {string} HTML (safe), wrapped in .notes-rendered
 */
export function renderNotesToHtml(raw) {
  if (raw == null || raw === "") return "";

  const parts = [];
  let pos = 0;

  while (pos < raw.length) {
    const open = raw.indexOf("```", pos);
    if (open === -1) {
      parts.push({ type: "text", value: raw.slice(pos) });
      break;
    }

    if (open > pos) {
      parts.push({ type: "text", value: raw.slice(pos, open) });
    }

    const cursor = open + 3;
    const nl = raw.indexOf("\n", cursor);

    let lang = "";
    let codeStart;

    if (nl === -1) {
      const close = raw.indexOf("```", cursor);
      if (close === -1) {
        parts.push({ type: "text", value: raw.slice(open) });
        break;
      }
      parts.push({
        type: "code",
        lang: "",
        value: raw.slice(cursor, close),
      });
      pos = close + 3;
      if (raw[pos] === "\n" || raw[pos] === "\r") {
        if (raw[pos] === "\r" && raw[pos + 1] === "\n") pos += 2;
        else pos += 1;
      }
      continue;
    }

    const infoLine = raw.slice(cursor, nl).trim();
    lang = /^[\w.+#-]+$/.test(infoLine) ? infoLine : "";
    codeStart = nl + 1;

    const close = raw.indexOf("```", codeStart);
    if (close === -1) {
      parts.push({
        type: "code",
        lang,
        value: raw.slice(codeStart),
      });
      break;
    }

    parts.push({
      type: "code",
      lang,
      value: raw.slice(codeStart, close),
    });

    pos = close + 3;
    if (raw[pos] === "\n" || raw[pos] === "\r") {
      if (raw[pos] === "\r" && raw[pos + 1] === "\n") pos += 2;
      else pos += 1;
    }
  }

  const html = parts
    .map((p) => {
      if (p.type === "text") return renderPlainSegment(p.value);
      const code = p.value.replace(/\n$/, "");
      const cls = escapeLangClass(p.lang);
      return `<pre class="notes-rendered__pre"><code class="notes-rendered__code${cls}">${escapeHtml(code)}</code></pre>`;
    })
    .join("");

  if (!html) return "";
  return `<div class="notes-rendered">${html}</div>`;
}
