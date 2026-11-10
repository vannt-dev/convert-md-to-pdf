/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * LaTeX math, in two steps.
 *
 * 1. `protectMath` takes the formulas out of the Markdown before it is parsed, and its
 *    `restore` puts them back into the HTML. Markdown would otherwise read the TeX as its own
 *    syntax: `\{` and `\,` lose the backslash, `\\` becomes `\`, `_` and `*` become emphasis.
 * 2. `renderMath` draws them with KaTeX once the page is in the browser.
 *
 * `$...$` follows pandoc's rule so prices stay text: no space just inside the dollars and no
 * digit right after the closing one ("$5 and $10" is not math). `\$` is a plain dollar.
 * Code, pre blocks and diagrams are left alone.
 *
 * Needs nothing from Node: the same file is shipped in the extension as extension/lib/math.js
 * and inlined in the CLI's HTML (a test keeps the two copies identical).
 */
(function (scope) {
  const SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'svg']);
  const NUMBER = /^\d+(?:[.,]\d+)?$/;

  // True when the line break at `at` is followed by an empty line (the paragraph ends there).
  function paragraphEnds(text, at) {
    let k = at + 1;
    while (text[k] === ' ' || text[k] === '\t' || text[k] === '\r') k++;
    return text[k] === '\n';
  }

  // The text cut into parts; a formula also carries `raw`, the source it was written as.
  function scanMath(text) {
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
        // A formula in the text stays within its paragraph.
        if (!display && text[j] === '\n' && paragraphEnds(text, j)) break;
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
      parts.push({ tex: display ? tex.trim() : tex, display, raw: text.slice(i, end + width) });
      i = end + width;
      last = i;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  }

  /**
   * Finds the math in a run of text.
   * @param {string} text
   * @returns {({ text: string } | { tex: string, display: boolean })[]} the text cut into parts
   */
  function splitMath(text) {
    return scanMath(text).map((p) => ('text' in p ? p : { tex: p.tex, display: p.display }));
  }

  // A formula's stand-in while Markdown is parsed: private-use characters around its number,
  // which no Markdown rule reads as syntax.
  const OPEN = '';
  const CLOSE = '';
  const STAND_IN = /(\d+)/g;
  // The "\text{A} = \text{B} - \text{C}" layout, which the preprocessor draws as a box itself.
  const DRAWN_BOX = /^\$\$\s*\\text\{[^}]+\}\s*=\s*\\text\{[^}]+\}\s*-\s*\\text\{[^}]+\}\s*\$\$$/;
  const FENCE = /^[ \t>]*(`{3,}|~{3,})(.*)$/;

  // Where the fenced code blocks are: [start, end) pairs.
  function fencedBlocks(markdown) {
    const blocks = [];
    let pos = 0;
    let fence = null;
    let fenceStart = 0;
    markdown.split('\n').forEach((line) => {
      const m = FENCE.exec(line.replace(/\r$/, ''));
      if (!fence) {
        // A backtick fence has no backtick in its info string; such a line is a code span.
        if (m && !(m[1][0] === '`' && m[2].includes('`'))) { fence = m[1]; fenceStart = pos; }
      } else if (m && m[1][0] === fence[0] && m[1].length >= fence.length && m[2].trim() === '') {
        blocks.push([fenceStart, pos + line.length]);
        fence = null;
      }
      pos += line.length + 1;
    });
    if (fence) blocks.push([fenceStart, markdown.length]);
    return blocks;
  }

  // The start of the run of exactly `n` backticks that closes a code span, or -1. A code span
  // stays within its paragraph.
  function closingBackticks(text, from, n) {
    for (let j = from; j < text.length; j++) {
      if (text[j] === '\n' && paragraphEnds(text, j)) return -1;
      if (text[j] !== '`') continue;
      let len = 1;
      while (text[j + len] === '`') len++;
      if (len === n) return j;
      j += len - 1;
    }
    return -1;
  }

  /**
   * Takes the math out of Markdown source, so that the Markdown parser cannot change it.
   * Fenced code and code spans are not searched.
   * @param {string} markdown
   * @returns {{ text: string, restore: (html: string) => string }} the Markdown to parse, and
   *   the function that puts the formulas into the HTML made from it
   */
  function protectMath(markdown) {
    const source = String(markdown || '');
    const kept = [];
    const keep = (item) => OPEN + (kept.push(item) - 1) + CLOSE;

    const plain = (text) => scanMath(text).map((p) => {
      if ('text' in p) {
        // `\$` is a dollar sign; kept apart so that two of them are never read as a formula.
        return p.text.replace(/\\([\s\S])/g, (pair, ch) => (ch === '$' ? keep({ raw: pair, dollar: true }) : pair));
      }
      return p.display && DRAWN_BOX.test(p.raw) ? p.raw : keep(p);
    }).join('');

    // Text outside fenced code: its code spans are passed over as they are.
    const prose = (text) => {
      let out = '';
      let last = 0;
      let i = 0;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] !== '`') { i++; continue; }
        let n = 1;
        while (text[i + n] === '`') n++;
        const close = closingBackticks(text, i + n, n);
        if (close === -1) { i += n; continue; }
        out += plain(text.slice(last, i)) + text.slice(i, close + n);
        i = last = close + n;
      }
      return out + plain(text.slice(last));
    };

    let text = '';
    let pos = 0;
    fencedBlocks(source).forEach(([start, end]) => {
      text += prose(source.slice(pos, start)) + source.slice(start, end);
      pos = end;
    });
    text += prose(source.slice(pos));
    return { text, restore: (html) => restoreMath(html, kept) };
  }

  function escapeText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const VERBATIM_TAGS = new Set(['pre', 'code', 'script', 'style', 'textarea']);
  // A comment, a tag, or a stand-in in the text between them.
  const HTML_PART = /<!\-\-[\s\S]*?\-\->|<(\/?)([a-zA-Z][^\s\/>]*)(?:"[^"]*"|'[^']*'|[^>"'])*>|(\d+)/g;
  const ALONE_IN_PARAGRAPH = /<p>((\d+))<\/p>/g;

  // Puts the formulas into the HTML: as elements for `renderMath` in the text, and as the
  // source they were written as inside code and attribute values.
  function restoreMath(html, kept) {
    if (!kept.length || !html) return html;
    const written = (text) => text.replace(STAND_IN, (all, n) => (kept[n] ? escapeText(kept[n].raw) : all));
    let verbatim = 0;
    // A display formula on lines of its own takes the place of its paragraph.
    const blocks = html.replace(ALONE_IN_PARAGRAPH, (all, standIn, n) => (kept[n] && kept[n].display ? standIn : all));
    return blocks.replace(HTML_PART, (part, closing, tag, n) => {
      if (n === undefined) {
        if (tag && VERBATIM_TAGS.has(tag.toLowerCase())) verbatim = closing ? Math.max(0, verbatim - 1) : verbatim + 1;
        return written(part);
      }
      const item = kept[n];
      if (!item) return part;
      if (verbatim > 0) return escapeText(item.raw);
      if (item.dollar) return '<span class="math-dollar">$</span>';
      return item.display
        ? `<div class="formula-box">${escapeText(item.tex)}</div>`
        : `<span class="math-inline">${escapeText(item.tex)}</span>`;
    });
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

    // The formulas `protectMath` kept out of Markdown's way.
    root.querySelectorAll('.math-inline').forEach((el) => {
      if (el.children.length === 0) katex.render(el.textContent, el, options(false));
    });

    // Math in text that did not come through `protectMath`.
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

  const api = { splitMath, protectMath, renderMath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
