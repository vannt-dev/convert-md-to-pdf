/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Markmap mind maps: the Markdown headings and lists of a ```markmap block drawn as a mind map.
 *
 * 1. `toTree` reads the block with marked into markmap's tree (`{ content, children }`, the
 *    content as HTML). It runs wherever marked is: the CLI, the extension preview and the Word
 *    writer. `markmapBlock` is the HTML a block becomes, the tree in a data attribute and the
 *    source as the text, which is what a page that cannot draw the map shows.
 * 2. `renderMarkmaps` and `drawMarkmap` draw in a page that has markmap-view (and d3) loaded.
 *    The map is drawn once, without animation, and kept as a plain SVG picture sized to the
 *    map: nothing moves or folds in the PDF, the saved HTML or the Word picture.
 *
 * Needs nothing from Node: the same file is shipped in the extension as extension/lib/markmap.js
 * and inlined in the CLI's HTML (a test keeps the two copies identical).
 */
(function (scope) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // The options a block may set in its own front matter (`markmap:` then `key: value` lines).
  const NUMBER_OPTIONS = ['colorFreezeLevel', 'initialExpandLevel', 'maxWidth', 'spacingHorizontal', 'spacingVertical', 'paddingX'];
  // Long node text wraps at this width (pixels) unless the block sets maxWidth.
  const DEFAULT_OPTIONS = { maxWidth: 320 };
  // Relative addresses, web and mail links and anchors; anything else (javascript: ...) is text.
  const SAFE_HREF = /^(?:https?:|mailto:|#|[^:]*$)/i;
  // A font every system has: the Word picture is drawn without the page's web fonts.
  const FONT = '400 15px/20px Arial, Helvetica, sans-serif';
  const DARK_COLOURS = '--markmap-text-color: #e5e7eb; --markmap-circle-open-bg: #1e293b; ' +
    '--markmap-code-bg: #334155; --markmap-code-color: #e2e8f0; --markmap-a-color: #60a5fa;';
  const PADDING = 12;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function unquote(value) {
    const text = value.trim();
    return /^(["']).*\1$/.test(text) ? text.slice(1, -1) : text;
  }

  /**
   * Takes the block's own front matter off: `markmap:` and its indented `key: value` lines.
   * @returns {{ options: Object, body: string }}
   */
  function readOptions(source) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
    if (!match) return { options: {}, body: source };
    const options = {};
    let inside = false;
    for (const line of match[1].split(/\r?\n/)) {
      if (/^markmap:\s*$/.test(line)) { inside = true; continue; }
      if (!/^\s/.test(line)) { inside = false; continue; }
      const pair = inside && /^\s+([A-Za-z]+):\s*(.*)$/.exec(line);
      if (!pair) continue;
      const [, key, value] = pair;
      if (NUMBER_OPTIONS.includes(key) && Number.isFinite(Number(value)) && value.trim() !== '') {
        options[key] = Number(value);
      } else if (key === 'color' && value.trim()) {
        const list = /^\[(.*)\]$/.exec(value.trim());
        options.color = (list ? list[1].split(',') : [value]).map(unquote).filter(Boolean);
      }
    }
    return { options, body: source.slice(match[0].length) };
  }

  function node(content) {
    return { content, children: [] };
  }

  /**
   * The mind map of a block.
   * @param {string} source The block's Markdown
   * @param {Object} markedLib marked (the module, or the browser's `marked`)
   * @returns {{ root: Object, options: Object } | null} null when the block has nothing to draw
   */
  function toTree(source, markedLib) {
    const { options, body } = readOptions(String(source || ''));
    const md = new markedLib.Marked({ gfm: true });
    md.use({
      renderer: {
        // HTML written into a node is shown as text: the node is put into the page as HTML.
        html(token) { return escapeHtml(token.text); },
        link(token) {
          return SAFE_HREF.test(token.href || '') ? false : this.parser.parseInline(token.tokens);
        },
        // A picture is not loaded into the map (the Word picture could not show it): its text is.
        image(token) { return escapeHtml(token.text || ''); }
      }
    });
    const inline = (text) => md.parseInline(text || '').trim();
    const code = (token) => `<pre><code>${escapeHtml(token.text || '')}</code></pre>`;

    const addList = (list, parent) => {
      for (const item of list.items) {
        const child = node('');
        let content = null;
        for (const token of item.tokens) {
          if (token.type === 'list') addList(token, child);
          else if (token.type === 'text' || token.type === 'paragraph') {
            if (content === null) content = inline(token.text);
            else child.children.push(node(inline(token.text)));
          } else if (token.type === 'code') child.children.push(node(code(token)));
        }
        child.content = (item.task ? (item.checked ? '&#9745; ' : '&#9744; ') : '') + (content || '');
        parent.children.push(child);
      }
    };

    const root = node('');
    const stack = [{ depth: 0, node: root }];
    for (const token of md.lexer(body)) {
      if (token.type === 'heading') {
        while (stack.length > 1 && stack[stack.length - 1].depth >= token.depth) stack.pop();
        const heading = node(inline(token.text));
        stack[stack.length - 1].node.children.push(heading);
        stack.push({ depth: token.depth, node: heading });
        continue;
      }
      const parent = stack[stack.length - 1].node;
      if (token.type === 'list') addList(token, parent);
      else if (token.type === 'paragraph') parent.children.push(node(inline(token.text)));
      else if (token.type === 'code') parent.children.push(node(code(token)));
    }
    if (!root.children.length) return null;
    // One top-level node is the centre of the map; several hang off an empty one.
    return { root: root.children.length === 1 ? root.children[0] : root, options };
  }

  /**
   * The HTML a ```markmap block becomes in the page: drawn by renderMarkmaps, or shown as its
   * source where it cannot be.
   * @param {string} source
   * @param {Object} markedLib
   * @returns {string}
   */
  function markmapBlock(source, markedLib) {
    const tree = toTree(source, markedLib);
    const data = tree ? ` data-markmap="${escapeHtml(JSON.stringify(tree))}"` : '';
    return `<div class="markmap-container"><pre class="markmap-source"${data}>${escapeHtml(source)}</pre></div>`;
  }

  /**
   * Draws a mind map as a still SVG picture, the size of the map.
   * @param {{ root: Object, options: Object }} tree What toTree returned
   * @param {{ markmap: Object, document?: Document, dark?: boolean }} libraries `markmap` is
   *   markmap-view (the browser's `markmap`); `dark` draws light text for a dark page
   * @returns {Promise<string>} the SVG
   */
  async function drawMarkmap(tree, libraries) {
    const view = libraries && libraries.markmap;
    if (!view || !view.Markmap) throw new Error('Markmap is not loaded');
    const doc = libraries.document || scope.document;
    const win = doc.defaultView || scope;
    // Drawn out of sight but laid out: markmap measures each node's text in the page.
    const holder = doc.createElement('div');
    holder.style.cssText = 'position:absolute;left:-100000px;top:0;width:1600px;height:1200px;visibility:hidden;overflow:hidden;';
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '1600');
    svg.setAttribute('height', '1200');
    holder.appendChild(svg);
    doc.body.appendChild(holder);
    let mm = null;
    const frame = win.requestAnimationFrame;
    try {
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      const colours = libraries.dark ? DARK_COLOURS : '';
      mm = new view.Markmap(svg, {
        ...(view.deriveOptions ? view.deriveOptions({ ...DEFAULT_OPTIONS, ...tree.options }) : DEFAULT_OPTIONS),
        duration: 0,
        zoom: false,
        pan: false,
        style: (id) => `.${id} { --markmap-font: ${FONT}; ${colours} }`
      });
      // No animation: every change lands at once, so the picture is final when setData ends.
      mm.transition = (selection) => selection;
      // markmap waits for a frame before measuring, and a headless page may never paint one.
      win.requestAnimationFrame = (callback) => win.setTimeout(callback, 0);
      try {
        await mm.setData(JSON.parse(JSON.stringify(tree.root)));
      } finally {
        win.requestAnimationFrame = frame;
      }
      const { x1, y1, x2, y2 } = mm.state.rect;
      const width = Math.ceil(x2 - x1 + PADDING * 2);
      const height = Math.ceil(y2 - y1 + PADDING * 2);
      svg.setAttribute('viewBox', `${x1 - PADDING} ${y1 - PADDING} ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      mm.g.attr('transform', null);
      return new win.XMLSerializer().serializeToString(svg);
    } finally {
      if (mm) mm.destroy();
      holder.remove();
    }
  }

  /**
   * Draws every ```markmap block under `container` (what markmapBlock wrote) in its place.
   * A block that cannot be drawn keeps showing its source.
   * @param {Element} container
   * @param {{ markmap: Object, dark?: boolean }} libraries
   * @returns {Promise<void>}
   */
  async function renderMarkmaps(container, libraries) {
    const doc = container.ownerDocument || scope.document;
    for (const source of container.querySelectorAll('pre.markmap-source[data-markmap]')) {
      try {
        const svg = await drawMarkmap(JSON.parse(source.getAttribute('data-markmap')), { ...libraries, document: doc });
        const holder = doc.createElement('div');
        holder.innerHTML = svg;
        const picture = holder.firstElementChild;
        picture.setAttribute('role', 'img');
        picture.setAttribute('aria-label', source.textContent.trim());
        source.replaceWith(picture);
      } catch (err) {
        if (scope.console) scope.console.error('Markmap render error:', err);
      }
    }
  }

  const api = { toTree, markmapBlock, drawMarkmap, renderMarkmaps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfMarkmap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
