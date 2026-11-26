/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const markedLib = require('marked');
const { Marked, Renderer } = markedLib;
const obsidianSyntax = require('./obsidian');
const hljs = require('highlight.js/lib/common');
const { 
  parseFrontMatter, 
  generateCoverPage, 
  preprocessMarkdown, 
  generateToc, 
  readCustomCss, 
  sanitizeHtml, 
  escapeHtml 
} = require('./utils');
const { getHtmlTemplate } = require('./templates');
const { applyFootnotes } = require('./footnotes');
const { pageMarksCss } = require('./pagemarks');
const { protectMath } = require('./math');
const { markmapBlock } = require('./markmap');

/**
 * Builds marked custom renderer for diagrams, UI mockups, and headings
 * @param {Map<string, string>} headingsMap 
 * @param {boolean} highlight Colour fenced code blocks that name a known language
 * @param {boolean} markmap Draw ```markmap blocks as mind maps (markmap.js)
 * @returns {marked.Renderer}
 */
function buildMarkedRenderer(headingsMap, highlight = true, markmap = true) {
  const renderer = new Renderer();
  const originalCodeRenderer = renderer.code.bind(renderer);

  renderer.code = function(token) {
    const text = token.text || '';
    const lang = token.lang || '';

    if (lang === 'mermaid') {
      return `<div class="mermaid-container"><pre class="mermaid">${text}</pre></div>`;
    }

    if (markmap && lang.trim().split(/\s+/)[0] === 'markmap') {
      return markmapBlock(text, markedLib);
    }

    if (text.includes('┌') && text.includes('└')) {
      return `<div class="ui-mockup-container"><pre class="ui-mockup"><code>${escapeHtml(text)}</code></pre></div>`;
    }

    // Only fences that name a language are coloured: guessing one gets short snippets wrong.
    const language = lang.trim().split(/\s+/)[0];
    if (highlight && language && hljs.getLanguage(language)) {
      const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>\n`;
    }

    return originalCodeRenderer.call(this, token);
  };

  renderer.heading = function({ tokens, depth, text }) {
    const slug = headingsMap.get(text.trim()) || `heading-${depth}`;
    return `<h${depth} id="${slug}">${this.parser.parseInline(tokens)}</h${depth}>`;
  };

  return renderer;
}

/**
 * Wraps section headers with section-group divs for clean page-break handling
 * @param {string} html 
 * @returns {string}
 */
function wrapSectionGroups(html) {
  let wrapped = html.replace(
    /<h3>(.*?)<\/h3>\s*(<div class="ui-mockup-container">|<table|<div class="mermaid-container">|<div class="markmap-container">|<ul|<ol)/g, 
    '<div class="section-group"><h3>$1</h3>$2'
  );
  return wrapped.replace(
    /(<\/table>|<\/div>|<\/ul>|<\/ol>)\s*(?=<h[1-4]>|<hr|\$)/g, 
    '$1</div>'
  );
}

/**
 * Converts Markdown content into a fully styled HTML string
 * @param {string} rawMarkdownContent 
 * @param {Object} options 
 * @returns {string} HTML string
 */
function parseMarkdownToHtml(rawMarkdownContent, options = {}) {
  // 1. Extract Front Matter & Metadata
  const { data: frontMatter, content: markdownContent } = parseFrontMatter(rawMarkdownContent);
  const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
  const title = frontMatter.title || options.title || (titleMatch ? titleMatch[1].trim() : 'Converted Document');
  const subtitle = frontMatter.subtitle || options.subtitle || '';
  const author = frontMatter.author || options.author || '';
  const date = frontMatter.date || options.date || '';
  // Document language, as for EPUB: sets the cover labels and the page's lang attribute
  const language = String(frontMatter.lang || frontMatter.language || options.language || 'en');

  // 2. Merge options
  const mergedOptions = {
    theme: options.theme || frontMatter.theme || 'modern',
    font: options.font || frontMatter.font || 'Inter',
    pageSize: options.pageSize || frontMatter.pageSize || 'A4',
    orientation: options.orientation || frontMatter.orientation || (frontMatter.landscape ? 'landscape' : 'portrait'),
    margin: options.margin || frontMatter.margin || '14mm 12mm 16mm 12mm',
    toc: options.toc !== undefined ? options.toc : (frontMatter.toc || false),
    cover: options.cover !== undefined ? options.cover : (frontMatter.cover || false),
    // Running header/footer and page numbers: off unless asked for (see pagemarks.js)
    header: options.header !== undefined ? options.header : frontMatter.header,
    footer: options.footer !== undefined ? options.footer : frontMatter.footer,
    pageNumbers: options.pageNumbers !== undefined ? options.pageNumbers : frontMatter.pageNumbers,
    watermark: options.watermark !== undefined ? options.watermark : frontMatter.watermark,
    mermaid: options.mermaid !== undefined ? options.mermaid : (frontMatter.mermaid !== false),
    markmap: options.markmap !== undefined ? options.markmap !== false : (frontMatter.markmap !== false),
    katex: options.katex !== undefined ? options.katex : (frontMatter.katex !== false),
    highlight: options.highlight !== undefined ? options.highlight : (frontMatter.highlight !== false),
    obsidian: options.obsidian !== undefined ? options.obsidian !== false : (frontMatter.obsidian !== false),
    customCss: options.customCss || '',
    cssFile: options.cssFile || frontMatter.cssFile || frontMatter.css
  };

  // 3. Preprocess Markdown (footnotes, LaTeX, pagebreaks, alerts)
  // The formulas are taken out first, so that neither the preprocessor nor Markdown changes the
  // TeX; they come back once the HTML is made. Without KaTeX nothing would draw them.
  const math = mergedOptions.katex ? protectMath(markdownContent) : null;
  let mathless = math ? math.text : markdownContent;
  // Obsidian callouts become quotes with a bold title before GitHub's alerts are read.
  if (mergedOptions.obsidian) mathless = obsidianSyntax.applyCallouts(mathless);
  const processedMd = preprocessMarkdown(applyFootnotes(mathless), { mathProtected: !!math });

  // 4. Generate TOC & Cover Page
  let tocHtml = '';
  let headingsMap = new Map();
  if (mergedOptions.toc) {
    const tocResult = generateToc(processedMd);
    tocHtml = tocResult.tocHtml;
    headingsMap = tocResult.headingsMap;
  }

  const coverHtml = generateCoverPage({
    title,
    subtitle,
    author,
    date,
    cover: mergedOptions.cover,
    language
  });

  // 5. Read custom CSS file if specified
  let customCss = mergedOptions.customCss || '';
  if (mergedOptions.cssFile) {
    customCss += '\n' + readCustomCss(mergedOptions.cssFile);
  }

  // Page numbers and running header/footer, printed in the page margins
  const pageCss = pageMarksCss(
    {
      header: mergedOptions.header,
      footer: mergedOptions.footer,
      pageNumbers: mergedOptions.pageNumbers,
      watermark: mergedOptions.watermark,
      font: mergedOptions.font
    },
    { title, author, date }
  );
  if (pageCss) {
    customCss = pageCss + '\n' + customCss;
  }

  // 6. Parse Markdown using custom renderer
  const renderer = buildMarkedRenderer(headingsMap, mergedOptions.highlight, mergedOptions.markmap);
  const markdown = new Marked({ gfm: true, breaks: true }, { renderer });
  if (mergedOptions.obsidian) {
    const vault = options.vault || {};
    markdown.use(obsidianSyntax.markedExtension({
      resolveNote: vault.resolveNote,
      resolveImage: vault.resolveImage,
      // A wikilink to a heading gives the headings the anchors the table of contents would.
      headingId: obsidianSyntax.headingIdsOnDemand(headingsMap, () => generateToc(processedMd).headingsMap)
    }));
  }

  let bodyHtml = markdown.parse(processedMd);
  bodyHtml = sanitizeHtml(bodyHtml);

  // 7. Inject TOC, Cover Page & Section Groups
  if (tocHtml) {
    bodyHtml = bodyHtml.includes('</h1>') 
      ? bodyHtml.replace('</h1>', '</h1>\n' + tocHtml)
      : tocHtml + bodyHtml;
  }

  if (coverHtml) {
    bodyHtml = coverHtml + bodyHtml;
  }

  bodyHtml = wrapSectionGroups(bodyHtml);
  if (math) bodyHtml = math.restore(bodyHtml);

  // 8. Generate and return full HTML template
  return getHtmlTemplate({
    title,
    author,
    language,
    bodyHtml,
    options: {
      ...mergedOptions,
      customCss
    }
  });
}

module.exports = {
  parseMarkdownToHtml
};
