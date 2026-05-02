/**
 * Syntax highlighting for fenced code blocks in rendered notes (Prism).
 * Only runs on <code> elements that include a language-* class.
 */
import Prism from "prismjs";

import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-yaml.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-rust.js";

/**
 * @param {ParentNode} [root]
 */
export function highlightNotesCodeBlocks(root = document) {
  const codes = root.querySelectorAll(
    ".notes-rendered pre > code[class*='language-']",
  );
  for (const el of codes) {
    try {
      Prism.highlightElement(el);
    } catch {
      /* unknown or broken grammar */
    }
  }
}
