/**
 * Parse a markdown file into StudyItem payloads.
 *
 * Expected format:
 *
 * Category: some-category
 *
 * #### Prompt text
 *
 * Answer text (may span multiple paragraphs)
 *
 * #### Next prompt
 *
 * Next answer...
 */

function normalizeCategory(raw) {
  return (raw || "").trim().toLowerCase();
}

export function parseStudyItemMarkdown(text) {
  const src = (text || "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");

  // --- Category line ---
  let category = "";
  let i = 0;

  // skip leading blank lines
  while (i < lines.length && lines[i].trim() === "") i++;

  if (i < lines.length) {
    const m = lines[i].match(/^\s*Category\s*:\s*(.+?)\s*$/i);
    if (m) {
      category = normalizeCategory(m[1]);
      i++;
    }
  }

  // move to next content line
  while (i < lines.length && lines[i].trim() === "") i++;

  const rest = lines.slice(i).join("\n");

  // Split into sections by '#### '
  // Keep it strict to avoid matching deeper headings.
  const headingRegex = /^####\s+(.+?)\s*$/gm;

  const matches = [];
  let match;
  while ((match = headingRegex.exec(rest)) !== null) {
    matches.push({ index: match.index, prompt: match[1] });
  }

  const items = [];
  for (let idx = 0; idx < matches.length; idx++) {
    const start = matches[idx].index;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : rest.length;
    const chunk = rest.slice(start, end);

    const chunkLines = chunk.split("\n");
    const promptLine = chunkLines.shift();
    const prompt = (promptLine || "").replace(/^####\s+/, "").trim();

    // Remove leading blank lines before answer
    while (chunkLines.length && chunkLines[0].trim() === "") chunkLines.shift();

    const notes = chunkLines.join("\n").trimEnd();

    if (!prompt) continue;
    // allow notes to be empty (user might just want the prompt)

    items.push({ prompt, notes, category });
  }

  return { category, items };
}
