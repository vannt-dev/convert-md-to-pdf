/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Obsidian Markdown: `==highlight==`, wikilinks (`[[Note]]`, `[[Note#Heading]]`, `[[Note|alias]]`),
 * embeds (`![[picture.png]]`, `![[picture.png|300]]`, `![[Other note]]`) and callouts
 * (`> [!note] Title`).
 *
 * The inline syntax is read by marked, as an extension, so code spans and code blocks keep it as
 * written. Finding notes and pictures on disk is left to the caller (the CLI's src/core/vault.js):
 * without it, `[[#Heading]]` leads to a heading of the document, a picture embed loads its name as
 * a relative address, and a link to another note is its name in a muted style.
 *
 * Needs nothing from Node: the same file is shipped in the extension as extension/lib/obsidian.js
 * (a test keeps the two identical) and is part of the extension's Word writer.
 */
(function (scope) {
  const IMAGE = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;
  const SIZE = /^\s*(\d+)(?:\s*x\s*(\d+))?\s*$/;
  const FENCE = /^ {0,3}(`{3,}|~{3,})/;
  const EMBED = /^!\[\[([^[\]\n]+?)\]\]/;
  // Not `[[1]](url)` or `[[a]][ref]`: those are Markdown links whose text has brackets.
  const WIKILINK = /^\[\[([^[\]\n]+?)\]\](?![([])/;
  // A non-space, non-`=` character just inside both ends, so `a == b` and `====` stay text.
  const MARK = /^==(?=[^\s=])([^\n]*?[^\s=])==(?!=)/;
  const CALLOUT = /^( {0,3}>[ \t]*)\[!([A-Za-z][\w-]*)\]([+-]?)[ \t]*(.*)$/;
  // GitHub's alerts, written in capitals with no title: preprocess.js draws them as before.
  const GITHUB_ALERT = /^(NOTE|TIP|WARNING|IMPORTANT|CAUTION)$/;
  const CALLOUT_ICONS = {
    note: 'ℹ️', info: 'ℹ️', todo: '☑️', abstract: '📋', summary: '📋', tldr: '📋',
    tip: '💡', hint: '💡', important: '❗', success: '✅', check: '✅', done: '✅',
    question: '❓', help: '❓', faq: '❓', warning: '⚠️', caution: '🚫', attention: '⚠️',
    failure: '❌', fail: '❌', missing: '❌', danger: '⚡', error: '⚡', bug: '🐞',
    example: '🧪', quote: '💬', cite: '💬'
  };

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** A path as an address: each part percent-encoded, the slashes kept. */
  function encodePath(target) {
    return String(target)
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
  }

  /**
   * The anchor a heading gets in the table of contents (src/core/toc.js) and in Word and EPUB
   * (src/core/docmodel.js), before a number is added to tell equal headings apart.
   * @param {string} text
   * @returns {string}
   */
  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^\wÀ-ɏẠ-ỹ]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** What a heading line shows once its Markdown is read, as the table of contents cleans it. */
  function headingText(raw) {
    return String(raw)
      .replace(/!?\[\[([^[\]\n]+?)\]\]/g, (whole, inner) => {
        const target = parseTarget(inner);
        return target.alias || target.heading || target.name;
      })
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*+/g, '')
      .replace(/==/g, '');
  }

  /**
   * Reads what stands between the double brackets.
   * @param {string} inner e.g. `Note#Heading|alias`; `\|` also starts the alias (in a table)
   * @returns {{ name: string, heading: string, block: boolean, alias: string, options: string[] }}
   *   `block` for a `#^block` reference, which has no heading; `options` are the parts after
   *   the first `|` (an alias, or a picture's size)
   */
  function parseTarget(inner) {
    const parts = String(inner).split(/\\?\|/);
    const path = parts[0];
    const hash = path.indexOf('#');
    const name = (hash === -1 ? path : path.slice(0, hash)).trim();
    // `Note#Part#Section` leads to the last heading named.
    let heading = hash === -1 ? '' : path.slice(hash + 1).split('#').pop().trim();
    const block = heading.startsWith('^');
    if (block) heading = '';
    const options = parts.slice(1).map(part => part.trim());
    return { name, heading, block, alias: options.join('|').trim(), options };
  }

  /**
   * Looks a heading up by its text.
   * @param {Iterable<[string, string]>} entries [heading as written, its anchor], in document order
   * @returns {(text: string) => string | null} the anchor of the first heading with that text
   */
  function headingLookup(entries) {
    const ids = new Map();
    for (const [text, id] of entries) {
      const key = slugify(headingText(text));
      if (key && id && !ids.has(key)) ids.set(key, id);
    }
    return text => ids.get(slugify(text)) || null;
  }

  /**
   * `headingId` for markedExtension on a page whose headings take their anchors from a map of
   * heading text to anchor (the table of contents' map, which is empty without `--toc`). The map
   * is filled from `makeMap` only when a wikilink asks for an anchor, so a document without such
   * a link keeps the anchors it had.
   * @param {Map<string, string>} headingsMap The map the page's headings read
   * @param {() => Map<string, string>} makeMap
   * @returns {(text: string) => string | null}
   */
  function headingIdsOnDemand(headingsMap, makeMap) {
    let lookup = null;
    return text => {
      if (!lookup) {
        if (!headingsMap.size) for (const [heading, id] of makeMap()) headingsMap.set(heading, id);
        lookup = headingLookup(headingsMap);
      }
      return lookup(text);
    };
  }

  /**
   * The headings of a Markdown text with the anchors Word and EPUB give them (every depth,
   * numbered when equal), outside code blocks.
   * @param {string} markdown
   * @returns {[string, string][]}
   */
  function scanHeadings(markdown) {
    const counts = new Map();
    const found = [];
    let fence = null;
    String(markdown || '').split(/\r?\n/).forEach(line => {
      const fenceMatch = FENCE.exec(line);
      if (fence) {
        if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
        return;
      }
      if (fenceMatch) {
        fence = fenceMatch[1];
        return;
      }
      const match = /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
      if (!match) return;
      let slug = slugify(headingText(match[1]));
      if (!slug) return;
      const seen = counts.get(slug) || 0;
      counts.set(slug, seen + 1);
      if (seen > 0) slug = `${slug}-${seen + 1}`;
      found.push([match[1], slug]);
    });
    return found;
  }

  /**
   * The marked extension for the inline syntax.
   * @param {Object} [options]
   * @param {(name: string) => ({ here?: boolean, firstHeading?: string, href?: string } | null)} [options.resolveNote]
   *   Where a note is: in this output (`here`; `firstHeading` is the text of its first heading)
   *   and/or a file (`href`, a relative path), or null when it cannot be found
   * @param {(name: string) => (string | null)} [options.resolveImage] The path a picture embed loads,
   *   or null when there is no such picture; by default the name as written
   * @param {(text: string) => (string | null)} [options.headingId] The anchor of a heading of the
   *   output, by its text; null when it has none
   * @returns {{ extensions: Object[] }}
   */
  function markedExtension(options = {}) {
    const resolveNote = options.resolveNote || (() => null);
    const resolveImage = options.resolveImage || (name => name);
    const headingId = options.headingId || (() => null);

    // Where a link leads: { href } or, for a note that is there without an anchor to lead to, { href: null }.
    const linkTarget = target => {
      if (!target.name) {
        const id = target.heading ? headingId(target.heading) : null;
        return id ? { href: `#${id}` } : target.heading ? { href: null } : null;
      }
      const note = resolveNote(target.name);
      if (!note) return null;
      if (note.here) {
        const heading = target.heading || note.firstHeading;
        const id = heading ? headingId(heading) : null;
        if (id) return { href: `#${id}` };
        // Only part of the note is here, or its headings have no anchors: its file, if known.
        if (!note.href) return { href: null };
      }
      const anchor = target.heading ? `#${slugify(target.heading)}` : '';
      return { href: `${encodePath(note.href)}${anchor}` };
    };

    const label = target => {
      if (target.alias) return target.alias;
      if (!target.name) return target.heading;
      return target.heading ? `${target.name} > ${target.heading}` : target.name;
    };

    const wikilinkToken = (raw, target) => {
      const found = linkTarget(target);
      return { type: 'wikilink', raw, text: label(target), href: found ? found.href : null, resolved: Boolean(found) };
    };

    const embed = {
      name: 'obsidianImage',
      level: 'inline',
      start: src => {
        const index = src.indexOf('![[');
        return index === -1 ? undefined : index;
      },
      tokenizer(src) {
        const match = EMBED.exec(src);
        if (!match) return undefined;
        const target = parseTarget(match[1]);
        if (!target.name && !target.heading) return undefined;
        if (!IMAGE.test(target.name)) {
          // A note (or another file) that was not put in place: a link to it.
          return wikilinkToken(match[0], { ...target, alias: target.alias });
        }
        let width = '';
        let height = '';
        const alt = [];
        for (const option of target.options) {
          const size = SIZE.exec(option);
          if (size && !width) {
            width = size[1];
            height = size[2] || '';
          } else if (option) {
            alt.push(option);
          }
        }
        const file = resolveImage(target.name);
        const shown = alt.join(' ') || target.name.split('/').pop();
        if (!file) return { type: 'wikilink', raw: match[0], text: shown, href: null, resolved: false };
        return { type: 'obsidianImage', raw: match[0], src: encodePath(file), alt: shown, width, height };
      },
      renderer: token => token.type === 'wikilink' ? renderWikilink(token) : renderImage(token)
    };

    const wikilink = {
      name: 'wikilink',
      level: 'inline',
      start: src => {
        const index = src.indexOf('[[');
        return index === -1 ? undefined : index;
      },
      tokenizer(src) {
        const match = WIKILINK.exec(src);
        if (!match) return undefined;
        const target = parseTarget(match[1]);
        if (!target.name && !target.heading) return undefined;
        return wikilinkToken(match[0], target);
      },
      renderer: token => renderWikilink(token)
    };

    const mark = {
      name: 'mark',
      level: 'inline',
      start: src => {
        const index = src.indexOf('==');
        return index === -1 ? undefined : index;
      },
      tokenizer(src) {
        const match = MARK.exec(src);
        if (!match) return undefined;
        return { type: 'mark', raw: match[0], text: match[1], tokens: this.lexer.inlineTokens(match[1]) };
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
      }
    };

    return { extensions: [embed, wikilink, mark] };
  }

  function renderWikilink(token) {
    const text = escapeHtml(token.text);
    if (token.href) return `<a class="wikilink" href="${escapeHtml(token.href)}">${text}</a>`;
    return `<span class="wikilink${token.resolved ? '' : ' wikilink-unresolved'}">${text}</span>`;
  }

  function renderImage(token) {
    const size = (token.width ? ` width="${token.width}"` : '') + (token.height ? ` height="${token.height}"` : '');
    return `<img class="obsidian-embed" src="${escapeHtml(token.src)}" alt="${escapeHtml(token.alt)}"${size}>`;
  }

  /**
   * Obsidian callouts: `> [!type] Title` (any case, `+`/`-` for folding are read and ignored)
   * starts a quote with the type's icon and the title in bold. GitHub's alerts (`> [!NOTE]` in
   * capitals, no title) are left to preprocess.js, so they look as they did. Code blocks are
   * left alone.
   * @param {string} markdown
   * @returns {string}
   */
  function applyCallouts(markdown) {
    if (!markdown || markdown.indexOf('[!') === -1) return markdown;
    let fence = null;
    return markdown
      .split('\n')
      .map(line => {
        const fenceMatch = FENCE.exec(line);
        if (fence) {
          if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
          return line;
        }
        if (fenceMatch) {
          fence = fenceMatch[1];
          return line;
        }
        const match = CALLOUT.exec(line.replace(/\r$/, ''));
        if (!match) return line;
        const [, quote, type, , title] = match;
        if (!title.trim() && GITHUB_ALERT.test(type)) return line;
        const key = type.toLowerCase();
        const icon = CALLOUT_ICONS[key] || 'ℹ️';
        const text = title.trim() || key.charAt(0).toUpperCase() + key.slice(1);
        return `${quote}**${icon} ${text}**${line.endsWith('\r') ? '\r' : ''}`;
      })
      .join('\n');
  }

  const api = {
    applyCallouts,
    headingIdsOnDemand,
    headingLookup,
    headingText,
    isImage: name => IMAGE.test(name),
    markedExtension,
    parseTarget,
    scanHeadings,
    slugify
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfObsidian = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
