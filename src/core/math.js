/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Draws LaTeX math with KaTeX once the page is in the browser: `$$...$$` blocks (which the
 * preprocessor turns into `.formula-box`) and `$...$` in the text.
 *
 * `$...$` follows pandoc's rule so prices stay text: no space just inside the dollars and no
 * digit right after the closing one ("$5 and $10" is not math).
 * Code, pre blocks and diagrams are left alone.
 *
 * Needs nothing from Node: the same file is shipped in the extension as extension/lib/math.js
 * and inlined in the CLI's HTML (a test keeps the two copies identical).
 */
(function (scope) {
  const SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'svg']);
  const NUMBER = /^\d+(?:[.,]\d+)?$/;

  /**
   * Finds the math in a run of text.
   * @param {string} text
   * @returns {({ text: string } | { tex: string, display: boolean })[]} the text cut into parts
   */
  function splitMath(text) {
    const parts = [];
    let last = 0;
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch !== '$') { i++; continue; }

      const display = text[i + 1] === '$';
      const width = display ? 2 : 1;
      const start = i + width;
      let end = -1;
      for (let j = start; j < text.length; j++) {
        if (text[j] === '\\') { j++; continue; }
        if (text[j] !== '$') continue;
        if (!display || text[j + 1] === '$') end = j;
        break;
      }
      const tex = end === -1 ? '' : text.slice(start, end);
      const ok = display
        ? tex.trim() !== ''
        : tex !== '' && !/^\s|\s$/.test(tex) && !/\d/.test(text[end + 1] || '') && !NUMBER.test(tex);
      if (!ok) { i += width; continue; }

      if (i > last) parts.push({ text: text.slice(last, i) });
      parts.push({ tex: display ? tex.trim() : tex, display });
      i = end + width;
      last = i;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  }

  function skipped(node, root) {
    for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.classList && (el.classList.contains('katex') || el.classList.contains('mermaid'))) return true;
    }
    return false;
  }

  /**
   * Draws the math inside `root` with KaTeX. Does nothing without KaTeX.
   * @param {Element} root
   * @param {object} katex the KaTeX library (window.katex)
   */
  function renderMath(root, katex) {
    if (!root || !katex) return;
    const options = (display) => ({ displayMode: display, throwOnError: false });

    // A `.formula-box` holding only text is one display formula; one with markup is the
    // "\text{A} = \text{B} - \text{C}" layout the preprocessor already drew.
    root.querySelectorAll('.formula-box').forEach((box) => {
      const tex = box.textContent.trim();
      if (box.children.length !== 0 || !tex) return;
      // Into a div of its own, so the box's styles for its direct <span>s stay off KaTeX's.
      const holder = box.ownerDocument.createElement('div');
      katex.render(tex, holder, options(true));
      box.replaceChildren(holder);
    });

    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.includes('$') && !skipped(n, root)) nodes.push(n);
    }
    nodes.forEach((node) => {
      const parts = splitMath(node.nodeValue);
      if (!parts.some((p) => 'tex' in p)) return;
      const frag = doc.createDocumentFragment();
      parts.forEach((p) => {
        if ('text' in p) { frag.appendChild(doc.createTextNode(p.text)); return; }
        const span = doc.createElement('span');
        span.innerHTML = katex.renderToString(p.tex, options(p.display));
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  const api = { splitMath, renderMath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
