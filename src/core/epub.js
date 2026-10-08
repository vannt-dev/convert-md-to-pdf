const crypto = require('crypto');
const hljs = require('highlight.js/lib/common');
const { buildDocument, collectHeadings, isPortableLink, plainText } = require('./docmodel');
const { readLocalImage } = require('./images');
const { createZip } = require('./zip');

/**
 * Markdown to EPUB 3, written from the document model. Every page is XHTML
 * serialized here, so it is well formed whatever raw HTML the Markdown holds.
 *
 * The book is split into one file per top-level heading, with a navigation
 * document (and an NCX for older readers) built from the headings. Local
 * images are embedded; an image on the web is replaced by a link to it, since
 * a reader may be offline. Themes, custom CSS, Mermaid and KaTeX are not
 * carried over: a reading system applies its own typography.
 */

function xml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLESHEET = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1, h2, h3, h4, h5, h6 { font-family: sans-serif; line-height: 1.25; page-break-after: avoid; }
h1 { font-size: 1.8em; margin-top: 1.5em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }
p { margin: 0.6em 0; }
a { color: #0b57d0; }
img { max-width: 100%; height: auto; }
code { font-family: monospace; font-size: 0.9em; background: #f2f2f2; padding: 0.1em 0.25em; }
pre { background: #f5f5f5; padding: 0.8em; white-space: pre-wrap; word-wrap: break-word; font-size: 0.85em; }
pre code { background: none; padding: 0; font-size: 1em; }
blockquote { margin: 0.8em 0; padding-left: 1em; border-left: 0.25em solid #bfbfbf; color: #595959; }
table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
th, td { border: 1px solid #bfbfbf; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }
th { background: #f2f2f2; }
hr { border: 0; border-top: 1px solid #bfbfbf; margin: 1.5em 0; }
ul.tasks { list-style: none; padding-left: 1.2em; }
.page-break { page-break-after: always; }
.cover { text-align: center; margin-top: 30%; }
.cover h1 { font-size: 2.2em; }
.cover .subtitle { font-size: 1.3em; color: #595959; }
.cover .line { color: #595959; }
nav ol { list-style: none; padding-left: 1.2em; }
.hljs-comment, .hljs-quote { color: #6a737d; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-type { color: #d73a49; }
.hljs-string, .hljs-regexp, .hljs-attr, .hljs-addition { color: #22863a; }
.hljs-number, .hljs-built_in, .hljs-symbol, .hljs-meta { color: #005cc5; }
.hljs-title, .hljs-section, .hljs-name, .hljs-function { color: #6f42c1; }
.hljs-deletion { color: #b31d28; }
`;

class EpubWriter {
  constructor(document, baseDir) {
    this.document = document;
    this.baseDir = baseDir;
    this.images = [];
    this.imagePaths = new Map();
    // Where each heading ends up, so a link to `#slug` can name the right file.
    this.targets = new Map();
  }

  image(run) {
    const { src, alt } = run.image;
    if (!this.imagePaths.has(src)) {
      const image = readLocalImage(src, this.baseDir);
      if (image) {
        const name = `images/image-${this.images.length + 1}.${image.extension}`;
        this.images.push({ name, data: image.data, mediaType: image.mediaType });
        this.imagePaths.set(src, name);
      } else {
        this.imagePaths.set(src, null);
      }
    }
    const path = this.imagePaths.get(src);
    if (path) return `<img src="${xml(path)}" alt="${xml(alt)}"/>`;
    // Not a local file: a link stands in for it when it has a web address.
    const label = xml(alt || src);
    return /^https?:\/\//i.test(src) ? `<a href="${xml(src)}">${label}</a>` : `<em>[${label}]</em>`;
  }

  /** The address a link is written with, or null when it would lead nowhere from inside the book. */
  href(target) {
    if (target[0] !== '#') return isPortableLink(target) ? target : null;
    let id = target.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (_) {
      // Used as written.
    }
    const file = this.targets.get(id);
    return file ? `${file}#${encodeURIComponent(id)}` : null;
  }

  runs(runs) {
    return runs
      .map(run => {
        let html;
        if (run.lineBreak) return '<br/>';
        if (run.image) html = this.image(run);
        else html = xml(run.text);
        if (run.code) html = `<code>${html}</code>`;
        if (run.sup) html = `<sup>${html}</sup>`;
        else if (run.sub) html = `<sub>${html}</sub>`;
        if (run.strike) html = `<del>${html}</del>`;
        if (run.italic) html = `<em>${html}</em>`;
        if (run.bold) html = `<strong>${html}</strong>`;
        const href = run.href ? this.href(run.href) : null;
        // An image that already became a link is not wrapped in a second one.
        if (href && !html.startsWith('<a ')) html = `<a href="${xml(href)}">${html}</a>`;
        return html;
      })
      .join('');
  }

  code(block) {
    const highlight = this.document.settings.highlight && block.lang && hljs.getLanguage(block.lang);
    // highlight.js escapes the code and adds only balanced spans, so its output is XHTML too.
    const body = highlight ? hljs.highlight(block.text, { language: block.lang, ignoreIllegals: true }).value : xml(block.text);
    return `<pre><code>${body}</code></pre>\n`;
  }

  blocks(blocks) {
    let output = '';
    for (const block of blocks) {
      switch (block.type) {
        case 'heading': {
          const tag = `h${Math.min(block.depth, 6)}`;
          output += `<${tag} id="${xml(block.id)}">${this.runs(block.runs)}</${tag}>\n`;
          break;
        }
        case 'paragraph':
          output += `<p>${this.runs(block.runs)}</p>\n`;
          break;
        case 'code':
          output += this.code(block);
          break;
        case 'quote':
          output += `<blockquote>\n${this.blocks(block.blocks) || '<p></p>\n'}</blockquote>\n`;
          break;
        case 'list': {
          const tasks = block.items.some(item => item.checked !== null);
          const tag = block.ordered ? 'ol' : 'ul';
          const attributes = block.ordered && block.start !== 1 ? ` start="${block.start}"` : !block.ordered && tasks ? ' class="tasks"' : '';
          const items = block.items.map(item => {
            const box = item.checked === null ? '' : item.checked ? '☑ ' : '☐ ';
            // A tight item is one line of text: no paragraph around it.
            const single = item.blocks.length === 1 && item.blocks[0].type === 'paragraph';
            const body = single ? box + this.runs(item.blocks[0].runs) : box + this.blocks(item.blocks);
            return `<li>${body}</li>\n`;
          });
          output += `<${tag}${attributes}>\n${items.join('') || '<li></li>\n'}</${tag}>\n`;
          break;
        }
        case 'table': {
          const cell = (tag, source) => {
            const align = source.align && source.align !== 'left' ? ` style="text-align: ${source.align}"` : '';
            return `<${tag}${align}>${this.runs(source.runs)}</${tag}>`;
          };
          output +=
            `<table>\n<thead>\n<tr>${block.header.map(source => cell('th', source)).join('')}</tr>\n</thead>\n` +
            (block.rows.length
              ? `<tbody>\n${block.rows.map(row => `<tr>${row.map(source => cell('td', source)).join('')}</tr>\n`).join('')}</tbody>\n`
              : '') +
            '</table>\n';
          break;
        }
        case 'rule':
          output += '<hr/>\n';
          break;
        case 'pageBreak':
          output += '<div class="page-break"></div>\n';
          break;
        default:
          break;
      }
    }
    return output;
  }

  page(title, body, bodyAttributes = '') {
    const language = xml(this.document.meta.language);
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n' +
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}">\n` +
      `<head>\n<meta charset="UTF-8"/>\n<title>${xml(title)}</title>\n<link rel="stylesheet" type="text/css" href="style.css"/>\n</head>\n` +
      `<body${bodyAttributes}>\n${body}</body>\n</html>\n`
    );
  }

  /** The blocks cut into chapters: a new one at every top-level heading. */
  chapters() {
    const { blocks, meta } = this.document;
    const chapters = [];
    for (const block of blocks) {
      const opens = block.type === 'heading' && block.depth === 1;
      if (opens || chapters.length === 0) {
        chapters.push({ title: opens ? plainText(block.runs) : meta.title, blocks: [] });
      }
      chapters[chapters.length - 1].blocks.push(block);
    }
    if (chapters.length === 0) chapters.push({ title: meta.title, blocks: [] });
    chapters.forEach((chapter, index) => {
      chapter.file = `chapter-${index + 1}.xhtml`;
      for (const heading of collectHeadings(chapter.blocks)) this.targets.set(heading.id, chapter.file);
    });
    return chapters;
  }

  /** Headings up to the third level as a nested list of { title, href, children }. */
  outline(chapters) {
    const root = { depth: 0, children: [] };
    const stack = [root];
    for (const chapter of chapters) {
      const headings = collectHeadings(chapter.blocks).filter(heading => heading.depth <= 3);
      // A chapter that opens with no heading still has to be reachable.
      if (!headings.length || chapter.blocks[0] !== headings[0]) {
        stack.length = 1;
        const entry = { depth: 1, title: chapter.title, href: chapter.file, children: [] };
        root.children.push(entry);
        stack.push(entry);
      }
      for (const heading of headings) {
        while (stack[stack.length - 1].depth >= heading.depth) stack.pop();
        const entry = { depth: heading.depth, title: plainText(heading.runs) || 'Untitled', href: `${chapter.file}#${encodeURIComponent(heading.id)}`, children: [] };
        stack[stack.length - 1].children.push(entry);
        stack.push(entry);
      }
    }
    return root.children;
  }

  build(now = new Date()) {
    const { meta, settings } = this.document;
    const chapters = this.chapters();
    const outline = this.outline(chapters);
    const pages = chapters.map(chapter => ({ name: chapter.file, data: this.page(chapter.title, this.blocks(chapter.blocks)) }));

    const navList = entries =>
      `<ol>\n${entries
        .map(entry => `<li><a href="${xml(entry.href)}">${xml(entry.title)}</a>${entry.children.length ? `\n${navList(entry.children)}` : ''}</li>\n`)
        .join('')}</ol>\n`;
    const nav = this.page(
      'Table of Contents',
      `<nav epub:type="toc" id="toc">\n<h1>Table of Contents</h1>\n${navList(outline)}</nav>\n`
    );

    let playOrder = 0;
    const navPoints = entries =>
      entries
        .map(entry => {
          const order = ++playOrder;
          return (
            `<navPoint id="nav-${order}" playOrder="${order}"><navLabel><text>${xml(entry.title)}</text></navLabel>` +
            `<content src="${xml(entry.href)}"/>${navPoints(entry.children)}</navPoint>\n`
          );
        })
        .join('');
    const identifier = `urn:uuid:${crypto.randomUUID()}`;
    const ncx =
      '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n' +
      `<head><meta name="dtb:uid" content="${identifier}"/><meta name="dtb:depth" content="3"/>` +
      '<meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>\n' +
      `<docTitle><text>${xml(meta.title)}</text></docTitle>\n<navMap>\n${navPoints(outline)}</navMap>\n</ncx>\n`;

    let cover = null;
    if (settings.cover) {
      cover = this.page(
        meta.title,
        `<div class="cover">\n<h1>${xml(meta.title)}</h1>\n` +
          (meta.subtitle ? `<p class="subtitle">${xml(meta.subtitle)}</p>\n` : '') +
          [meta.author, meta.date].filter(Boolean).map(line => `<p class="line">${xml(line)}</p>\n`).join('') +
          '</div>\n'
      );
    }

    const manifest = [
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
      '<item id="css" href="style.css" media-type="text/css"/>',
      ...(cover ? ['<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>'] : []),
      ...pages.map((page, index) => `<item id="chapter-${index + 1}" href="${page.name}" media-type="application/xhtml+xml"/>`),
      ...this.images.map((image, index) => `<item id="image-${index + 1}" href="${xml(image.name)}" media-type="${image.mediaType}"/>`)
    ];
    const spine = [
      ...(cover ? ['<itemref idref="cover"/>'] : []),
      // The contents page is always in the book for the reader's own menu; it is a page to read only when asked for.
      ...(settings.toc ? ['<itemref idref="nav"/>'] : []),
      ...pages.map((_, index) => `<itemref idref="chapter-${index + 1}"/>`)
    ];
    const opf =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">\n' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      `<dc:identifier id="book-id">${identifier}</dc:identifier>\n<dc:title>${xml(meta.title)}</dc:title>\n` +
      `<dc:language>${xml(meta.language)}</dc:language>\n` +
      (meta.author ? `<dc:creator>${xml(meta.author)}</dc:creator>\n` : '') +
      `<meta property="dcterms:modified">${now.toISOString().replace(/\.\d+Z$/, 'Z')}</meta>\n</metadata>\n` +
      `<manifest>\n${manifest.join('\n')}\n</manifest>\n<spine toc="ncx">\n${spine.join('\n')}\n</spine>\n</package>\n`;
    const container =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>\n';

    return createZip([
      // First and uncompressed: it is how a reader recognizes the file.
      { name: 'mimetype', data: 'application/epub+zip', store: true },
      { name: 'META-INF/container.xml', data: container },
      { name: 'OEBPS/content.opf', data: opf },
      { name: 'OEBPS/nav.xhtml', data: nav },
      { name: 'OEBPS/toc.ncx', data: ncx },
      { name: 'OEBPS/style.css', data: STYLESHEET },
      ...(cover ? [{ name: 'OEBPS/cover.xhtml', data: cover }] : []),
      ...pages.map(page => ({ name: `OEBPS/${page.name}`, data: page.data })),
      ...this.images.map(image => ({ name: `OEBPS/${image.name}`, data: image.data, store: true }))
    ]);
  }
}

/**
 * Converts Markdown to the bytes of an .epub file.
 * @param {string} rawMarkdown
 * @param {Object} [options] The converter's options, plus `baseDir`: the folder images are relative to
 * @returns {Buffer}
 */
function markdownToEpub(rawMarkdown, options = {}) {
  return new EpubWriter(buildDocument(rawMarkdown, options), options.baseDir).build();
}

module.exports = {
  markdownToEpub
};
