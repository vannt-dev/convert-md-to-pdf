const { marked } = require('marked');
const { parseFrontMatter } = require('./frontmatter');
const { applyFootnotes } = require('./footnotes');
const { preprocessMarkdown } = require('./utils');

/**
 * A format-neutral model of a Markdown document, for the exporters that do
 * not go through HTML (DOCX, EPUB).
 *
 * Blocks:
 *   { type: 'heading', depth, id, runs }
 *   { type: 'paragraph', runs }
 *   { type: 'code', lang, text }
 *   { type: 'quote', blocks }
 *   { type: 'list', ordered, start, items: [{ checked, blocks }] }
 *   { type: 'table', header: [{ align, runs }], rows: [[{ align, runs }]] }
 *   { type: 'rule' } | { type: 'pageBreak' }
 *
 * Runs are flat: nested emphasis becomes flags on each piece of text, so a
 * writer never has to balance tags.
 *   { text, bold, italic, strike, code, sup, sub, href }
 *   { image: { src, alt }, href } | { lineBreak: true }
 */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®',
  trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', laquo: '«', raquo: '»', times: '×', divide: '÷', deg: '°', plusmn: '±',
  micro: 'µ', para: '¶', sect: '§', euro: '€', pound: '£', yen: '¥', cent: '¢', minus: '−',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', bull: '•', middot: '·'
};

/**
 * Turns HTML character references into the characters they stand for.
 * A reference that is not known is left as it was written.
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text = '') {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
  });
}

/** The same slugs as the table of contents of the HTML output, kept unique. */
function createSlugger() {
  const counts = new Map();
  return (title, fallback) => {
    let slug = title
      .toLowerCase()
      .replace(/[^\wÀ-ɏẠ-ỹ]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
    const seen = counts.get(slug) || 0;
    counts.set(slug, seen + 1);
    if (seen > 0) slug = `${slug}-${seen + 1}`;
    return slug;
  };
}

const HTML_TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
const FLAG_TAGS = {
  b: 'bold', strong: 'bold', i: 'italic', em: 'italic', s: 'strike', del: 'strike',
  strike: 'strike', code: 'code', kbd: 'code', sup: 'sup', sub: 'sub'
};

function attribute(source, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(source);
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

/**
 * Collects the runs of one block. Raw HTML is reduced to what it means for
 * the text: emphasis, line breaks, links and images are kept, any other tag
 * is dropped and its content stays.
 */
function createRunCollector() {
  const runs = [];
  const flags = { bold: 0, italic: 0, strike: 0, code: 0, sup: 0, sub: 0 };
  // Raw <a> elements still open: a link target, or null for one whose text is skipped.
  const anchors = [];
  let skipping = 0;

  const styleNow = (style) => {
    const run = {};
    for (const flag of Object.keys(flags)) {
      if (style[flag] || flags[flag] > 0) run[flag] = true;
    }
    const href = style.href || anchors.filter(anchor => anchor && anchor.href).map(anchor => anchor.href).pop();
    if (href) run.href = href;
    return run;
  };

  const pushText = (text, style) => {
    if (!text || skipping > 0) return;
    const run = { text, ...styleNow(style) };
    const previous = runs[runs.length - 1];
    // Neighbouring pieces that look the same are one run.
    if (previous && previous.text !== undefined && sameStyle(previous, run)) previous.text += text;
    else runs.push(run);
  };

  const pushHtml = (html, style) => {
    let last = 0;
    HTML_TAG.lastIndex = 0;
    for (let match = HTML_TAG.exec(html); match; match = HTML_TAG.exec(html)) {
      pushText(decodeEntities(html.slice(last, match.index)), style);
      last = HTML_TAG.lastIndex;
      const closing = match[1] === '/';
      const tag = match[2].toLowerCase();
      const attributes = match[3] || '';

      if (FLAG_TAGS[tag]) {
        const flag = FLAG_TAGS[tag];
        flags[flag] = Math.max(0, flags[flag] + (closing ? -1 : 1));
      } else if (tag === 'br' && !closing) {
        if (skipping === 0) runs.push({ lineBreak: true });
      } else if (tag === 'img' && !closing) {
        const src = attribute(attributes, 'src');
        if (src && skipping === 0) {
          runs.push({ image: { src, alt: attribute(attributes, 'alt') || '' }, ...styleNow(style) });
        }
      } else if (tag === 'a') {
        if (closing) {
          const anchor = anchors.pop();
          if (anchor === null) skipping = Math.max(0, skipping - 1);
        } else if (/\bfootnote-backref\b/.test(attributes)) {
          // The arrow back to the text means nothing without the link.
          anchors.push(null);
          skipping += 1;
        } else {
          const href = attribute(attributes, 'href');
          // A footnote number stays a number; its target is a list item further down.
          anchors.push({ href: href && !/^#fn-?/.test(href) ? href : null });
        }
      }
    }
    pushText(decodeEntities(html.slice(last)), style);
  };

  const walk = (tokens, style) => {
    for (const token of tokens || []) {
      switch (token.type) {
        case 'strong': walk(token.tokens, { ...style, bold: true }); break;
        case 'em': walk(token.tokens, { ...style, italic: true }); break;
        case 'del': walk(token.tokens, { ...style, strike: true }); break;
        case 'codespan': pushText(decodeEntities(token.text), { ...style, code: true }); break;
        case 'br': if (skipping === 0) runs.push({ lineBreak: true }); break;
        case 'link': walk(token.tokens, { ...style, href: token.href }); break;
        case 'image':
          if (skipping === 0) runs.push({ image: { src: token.href, alt: token.text || '' }, ...styleNow(style) });
          break;
        case 'html': pushHtml(token.text, style); break;
        case 'checkbox': break;
        case 'escape': pushText(token.text, style); break;
        default:
          if (token.tokens) walk(token.tokens, style);
          else if (typeof token.text === 'string') pushText(decodeEntities(token.text), style);
      }
    }
  };

  return { runs, walk, pushHtml };
}

function sameStyle(a, b) {
  for (const key of ['bold', 'italic', 'strike', 'code', 'sup', 'sub', 'href']) {
    if ((a[key] || false) !== (b[key] || false)) return false;
  }
  return true;
}

function inlineRuns(tokens) {
  const collector = createRunCollector();
  collector.walk(tokens, {});
  return trimRuns(collector.runs);
}

function htmlRuns(html) {
  const collector = createRunCollector();
  collector.pushHtml(html, {});
  return trimRuns(collector.runs);
}

/**
 * Drops the whitespace at both ends of a block: all that a block of bare tags
 * leaves, or what stood before a tag whose content was skipped.
 */
function trimRuns(runs) {
  const blank = run => run.text !== undefined && run.text.trim() === '';
  while (runs.length && blank(runs[0])) runs.shift();
  while (runs.length && blank(runs[runs.length - 1])) runs.pop();
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (first && first.text !== undefined) first.text = first.text.replace(/^\s+/, '');
  if (last && last.text !== undefined) last.text = last.text.replace(/\s+$/, '');
  return runs;
}

/**
 * Whether a link still means something once the document is a single file:
 * a web or mail address does, a path to a neighbouring file does not.
 * @param {string} href
 * @returns {boolean}
 */
function isPortableLink(href) {
  return /^(https?:|mailto:|tel:|ftp:)/i.test(href || '');
}

/** The text of a list of runs, for slugs, titles and alt text. */
function plainText(runs) {
  return runs.map(run => (run.text !== undefined ? run.text : run.image ? run.image.alt : ' ')).join('');
}

function toBlocks(tokens, slug) {
  const blocks = [];
  for (const token of tokens || []) {
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'heading': {
        const runs = inlineRuns(token.tokens);
        blocks.push({ type: 'heading', depth: token.depth, id: slug(plainText(runs), `heading-${blocks.length + 1}`), runs });
        break;
      }
      case 'code':
        blocks.push({ type: 'code', lang: (token.lang || '').trim().split(/\s+/)[0], text: token.text || '' });
        break;
      case 'blockquote':
        blocks.push({ type: 'quote', blocks: toBlocks(token.tokens, slug) });
        break;
      case 'list':
        blocks.push({
          type: 'list',
          ordered: Boolean(token.ordered),
          start: Number.isInteger(token.start) ? token.start : 1,
          items: token.items.map(item => ({
            checked: item.task ? Boolean(item.checked) : null,
            blocks: toBlocks(item.tokens, slug)
          }))
        });
        break;
      case 'table': {
        const cell = (source, index) => ({ align: token.align[index] || null, runs: inlineRuns(source.tokens) });
        blocks.push({ type: 'table', header: token.header.map(cell), rows: token.rows.map(row => row.map(cell)) });
        break;
      }
      case 'hr':
        blocks.push({ type: 'rule' });
        break;
      case 'html': {
        if (/class=["'][^"']*\bpage-break\b/.test(token.text)) {
          blocks.push({ type: 'pageBreak' });
        } else if (/<section class="footnotes">/.test(token.text)) {
          // The notes follow as an ordinary numbered list; a rule sets them apart.
          blocks.push({ type: 'rule' });
        } else {
          const runs = htmlRuns(token.text);
          if (runs.length) blocks.push({ type: 'paragraph', runs });
        }
        break;
      }
      default: {
        const runs = inlineRuns(token.tokens || [token]);
        if (runs.length) blocks.push({ type: 'paragraph', runs });
      }
    }
  }
  return blocks;
}

/**
 * Reads a Markdown document into its metadata and blocks.
 * @param {string} rawMarkdown
 * @param {Object} [options] The converter's options; front matter fills in what they leave out
 * @returns {{ meta: Object, blocks: Object[], settings: Object }}
 */
function buildDocument(rawMarkdown = '', options = {}) {
  const { data: frontMatter, content } = parseFrontMatter(rawMarkdown);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const meta = {
    title: frontMatter.title || options.title || (titleMatch ? titleMatch[1].trim() : 'Converted Document'),
    subtitle: frontMatter.subtitle || options.subtitle || '',
    author: frontMatter.author || options.author || '',
    date: frontMatter.date || options.date || '',
    language: frontMatter.lang || frontMatter.language || options.language || 'en'
  };
  const settings = {
    font: options.font || frontMatter.font || 'Inter',
    pageSize: options.pageSize || frontMatter.pageSize || 'A4',
    orientation: options.orientation || frontMatter.orientation || (frontMatter.landscape ? 'landscape' : 'portrait'),
    margin: options.margin || frontMatter.margin || '14mm 12mm 16mm 12mm',
    toc: options.toc !== undefined ? options.toc : Boolean(frontMatter.toc),
    cover: options.cover !== undefined ? options.cover : Boolean(frontMatter.cover),
    highlight: options.highlight !== undefined ? options.highlight : frontMatter.highlight !== false
  };

  const processed = preprocessMarkdown(applyFootnotes(content));
  const tokens = marked.lexer(processed, { gfm: true, breaks: true });
  return { meta, blocks: toBlocks(tokens, createSlugger()), settings };
}

/** Every heading of the document, at any depth of nesting, in order. */
function collectHeadings(blocks, found = []) {
  for (const block of blocks) {
    if (block.type === 'heading') found.push(block);
    else if (block.type === 'quote') collectHeadings(block.blocks, found);
    else if (block.type === 'list') block.items.forEach(item => collectHeadings(item.blocks, found));
  }
  return found;
}

module.exports = {
  buildDocument,
  collectHeadings,
  decodeEntities,
  isPortableLink,
  plainText
};
