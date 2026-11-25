/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const { Marked } = require('marked');
const { parseFrontMatter } = require('./frontmatter');
const { applyFootnotes } = require('./footnotes');
const { preprocessMarkdown } = require('./preprocess');
const { protectMath } = require('./math');
const { parseMathml } = require('./omml');
const obsidianSyntax = require('./obsidian');

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
 *   { type: 'diagram', text }        a Mermaid diagram, as its source
 *   { type: 'math', tex, raw }       a formula on lines of its own
 *
 * Runs are flat: nested emphasis becomes flags on each piece of text, so a
 * writer never has to balance tags.
 *   { text, bold, italic, strike, code, sup, sub, mark, href }   mark: highlighted (`==text==`)
 *   { image: { src, alt }, href } | { lineBreak: true }
 *   { math: { tex, display, raw }, ... }  a formula in the text; `raw` is how it was typed
 */

// The stand-ins math.js `protectMath` puts in place of the formulas while Markdown is parsed.
const STAND_IN = /\uE000(\d+)\uE001/g;

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
  strike: 'strike', code: 'code', kbd: 'code', sup: 'sup', sub: 'sub', mark: 'mark'
};

function attribute(source, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(source);
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

/**
 * Collects the runs of one block. Raw HTML is reduced to what it means for
 * the text: emphasis, line breaks, links and images are kept, any other tag
 * is dropped and its content stays.
 * @param {Object[]} formulas What the math stand-ins in the text hold (math.js protectMath)
 */
function createRunCollector(formulas) {
  const runs = [];
  const flags = { bold: 0, italic: 0, strike: 0, code: 0, sup: 0, sub: 0, mark: 0 };
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

  const pushPlain = (text, style) => {
    if (!text) return;
    const run = { text, ...styleNow(style) };
    const previous = runs[runs.length - 1];
    // Neighbouring pieces that look the same are one run.
    if (previous && previous.text !== undefined && sameStyle(previous, run)) previous.text += text;
    else runs.push(run);
  };

  const pushText = (text, style) => {
    if (!text || skipping > 0) return;
    // In code a formula is the text it was typed as; `\$` is a dollar sign.
    const verbatim = style.code || flags.code > 0;
    let last = 0;
    for (const match of text.matchAll(STAND_IN)) {
      const item = formulas[match[1]];
      if (!item) continue;
      pushPlain(text.slice(last, match.index), style);
      last = match.index + match[0].length;
      if (verbatim || item.dollar) pushPlain(verbatim ? item.raw : '$', style);
      else runs.push({ math: { tex: item.tex, display: item.display, raw: item.raw }, ...styleNow(style) });
    }
    pushPlain(text.slice(last), style);
  };
  // An address or a description: formulas in it are kept as typed.
  const written = text => restoreFormulas(text, formulas);

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
          runs.push({ image: { src: written(src), alt: written(attribute(attributes, 'alt') || '') }, ...styleNow(style) });
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
          anchors.push({ href: href && !/^#fn-?/.test(href) ? written(href) : null });
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
        case 'mark': walk(token.tokens, { ...style, mark: true }); break;
        // Obsidian (obsidian.js): a wikilink is a link, or its text when it leads nowhere.
        case 'wikilink': pushText(token.text, token.href ? { ...style, href: token.href } : style); break;
        case 'obsidianImage':
          if (skipping === 0) runs.push({ image: { src: token.src, alt: token.alt }, ...styleNow(style) });
          break;
        case 'codespan': pushText(decodeEntities(token.text), { ...style, code: true }); break;
        case 'br': if (skipping === 0) runs.push({ lineBreak: true }); break;
        case 'link': walk(token.tokens, { ...style, href: written(token.href) }); break;
        case 'image':
          if (skipping === 0) runs.push({ image: { src: written(token.href), alt: written(token.text || '') }, ...styleNow(style) });
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
  for (const key of ['bold', 'italic', 'strike', 'code', 'sup', 'sub', 'mark', 'href']) {
    if ((a[key] || false) !== (b[key] || false)) return false;
  }
  return true;
}

/** Text with the math stand-ins put back as the formulas were typed. */
function restoreFormulas(text, formulas) {
  if (!formulas.length || !text) return text;
  return text.replace(STAND_IN, (all, index) => (formulas[index] ? formulas[index].raw : all));
}

function inlineRuns(tokens, formulas) {
  const collector = createRunCollector(formulas);
  collector.walk(tokens, {});
  return trimRuns(collector.runs);
}

function htmlRuns(html, formulas) {
  const collector = createRunCollector(formulas);
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
  return runs
    .map(run => (run.text !== undefined ? run.text : run.image ? run.image.alt : run.math ? run.math.tex : ' '))
    .join('');
}

/**
 * @param {Object[]} tokens marked's tokens
 * @param {{ slug: Function, formulas: Object[], diagrams: boolean }} context How headings get
 *   their ids, what the math stand-ins hold, and whether Mermaid code is a diagram
 */
function toBlocks(tokens, context) {
  const { slug, formulas } = context;
  const blocks = [];
  for (const token of tokens || []) {
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'heading': {
        const runs = inlineRuns(token.tokens, formulas);
        blocks.push({ type: 'heading', depth: token.depth, id: slug(plainText(runs), `heading-${blocks.length + 1}`), runs });
        break;
      }
      case 'code': {
        const lang = (token.lang || '').trim().split(/\s+/)[0];
        // Indented code is not passed over when the formulas are taken out.
        const text = restoreFormulas(token.text || '', formulas);
        if (lang === 'mermaid' && context.diagrams && text.trim()) blocks.push({ type: 'diagram', text });
        else blocks.push({ type: 'code', lang, text });
        break;
      }
      case 'blockquote':
        blocks.push({ type: 'quote', blocks: toBlocks(token.tokens, context) });
        break;
      case 'list':
        blocks.push({
          type: 'list',
          ordered: Boolean(token.ordered),
          start: Number.isInteger(token.start) ? token.start : 1,
          items: token.items.map(item => ({
            checked: item.task ? Boolean(item.checked) : null,
            blocks: toBlocks(item.tokens, context)
          }))
        });
        break;
      case 'table': {
        const cell = (source, index) => ({ align: token.align[index] || null, runs: inlineRuns(source.tokens, formulas) });
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
          const runs = htmlRuns(token.text, formulas);
          if (runs.length) blocks.push({ type: 'paragraph', runs });
        }
        break;
      }
      default: {
        const runs = inlineRuns(token.tokens || [token], formulas);
        const only = runs.length === 1 && runs[0].math && !runs[0].href ? runs[0].math : null;
        // A display formula on lines of its own takes the place of its paragraph.
        if (only && only.display) blocks.push({ type: 'math', tex: only.tex, raw: only.raw });
        else if (runs.length) blocks.push({ type: 'paragraph', runs });
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
    highlight: options.highlight !== undefined ? options.highlight : frontMatter.highlight !== false,
    // As in the PDF: `--no-katex` and `--no-mermaid`, or `katex: false` and `mermaid: false`.
    math: options.katex !== undefined ? options.katex !== false : frontMatter.katex !== false,
    diagrams: options.mermaid !== undefined ? options.mermaid !== false : frontMatter.mermaid !== false,
    // Obsidian syntax (obsidian.js): on unless `obsidian: false`
    obsidian: options.obsidian !== undefined ? options.obsidian !== false : frontMatter.obsidian !== false
  };

  // The formulas are taken out first, as for the PDF, so that Markdown cannot change them.
  const math = settings.math ? protectMath(content) : null;
  let mathless = math ? math.text : content;
  if (settings.obsidian) mathless = obsidianSyntax.applyCallouts(mathless);
  const processed = preprocessMarkdown(applyFootnotes(mathless), { mathProtected: Boolean(math) });
  const markdown = new Marked({ gfm: true, breaks: true });
  if (settings.obsidian) {
    const vault = options.vault || {};
    markdown.use(obsidianSyntax.markedExtension({
      resolveNote: vault.resolveNote,
      resolveImage: vault.resolveImage,
      headingId: obsidianSyntax.headingLookup(obsidianSyntax.scanHeadings(processed))
    }));
  }
  const tokens = markdown.lexer(processed);
  const context = { slug: createSlugger(), formulas: math ? math.formulas : [], diagrams: settings.diagrams };
  return { meta, blocks: toBlocks(tokens, context), settings };
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

/**
 * The diagrams and formulas of a document, each once, for whatever draws them before a writer
 * runs: the CLI's headless browser, or the extension's page.
 * @param {Object[]} blocks
 * @returns {{ diagrams: string[], formulas: { tex: string, display: boolean }[] }}
 */
function collectMedia(blocks) {
  const diagrams = new Set();
  const formulas = new Map();
  const addRuns = runs => {
    for (const run of runs) {
      if (run.math) formulas.set(mathKey(run.math.tex, run.math.display), { tex: run.math.tex, display: run.math.display });
    }
  };
  const walk = list => {
    for (const block of list) {
      if (block.type === 'diagram') diagrams.add(block.text);
      else if (block.type === 'math') formulas.set(mathKey(block.tex, true), { tex: block.tex, display: true });
      else if (block.runs) addRuns(block.runs);
      else if (block.type === 'quote') walk(block.blocks);
      else if (block.type === 'list') block.items.forEach(item => walk(item.blocks));
      else if (block.type === 'table') [block.header, ...block.rows].forEach(row => row.forEach(cell => addRuns(cell.runs)));
    }
  };
  walk(blocks);
  return { diagrams: [...diagrams], formulas: [...formulas.values()] };
}

/** How a drawn formula is looked up: the same TeX can be drawn inline and on a line of its own. */
function mathKey(tex, display) {
  return `${display ? 'D' : 'I'}:${tex}`;
}

/**
 * What the writers look the drawn diagrams and formulas up in.
 * @param {{ diagrams: string[], formulas: { tex: string, display: boolean }[] }} jobs What
 *   collectMedia found
 * @param {{ diagrams: Object[], formulas: Object[] }} results What media.js renderMedia drew for
 *   them, in the same order; one that failed carries an `error` and is left out
 * @returns {{ diagram: (text: string) => Object | null, formula: (tex: string, display: boolean) => Object | null }}
 *   a diagram as an image (`{ data, extension, mediaType, size }`), a formula as parsed MathML
 */
function mediaLookup(jobs, results = {}) {
  const diagrams = new Map();
  const formulas = new Map();
  jobs.diagrams.forEach((text, index) => {
    const drawn = (results.diagrams || [])[index];
    if (!drawn || !drawn.png || !(drawn.width > 0) || !(drawn.height > 0)) return;
    const data = Uint8Array.from(atob(drawn.png), character => character.charCodeAt(0));
    diagrams.set(text, { data, extension: 'png', mediaType: 'image/png', size: { width: drawn.width, height: drawn.height } });
  });
  jobs.formulas.forEach((formula, index) => {
    const drawn = (results.formulas || [])[index];
    const math = drawn && drawn.mathml ? parseMathml(drawn.mathml) : null;
    if (math) formulas.set(mathKey(formula.tex, formula.display), math);
  });
  return {
    diagram: text => diagrams.get(text) || null,
    formula: (tex, display) => formulas.get(mathKey(tex, display)) || null
  };
}

module.exports = {
  buildDocument,
  collectHeadings,
  collectMedia,
  decodeEntities,
  isPortableLink,
  mathKey,
  mediaLookup,
  plainText
};
