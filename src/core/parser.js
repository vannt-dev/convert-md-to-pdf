const { marked } = require('marked');
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

/**
 * Builds marked custom renderer for diagrams, UI mockups, and headings
 * @param {Map<string, string>} headingsMap 
 * @returns {marked.Renderer}
 */
function buildMarkedRenderer(headingsMap) {
  const renderer = new marked.Renderer();
  const originalCodeRenderer = renderer.code.bind(renderer);

  renderer.code = function(codeArg, infostringArg, escapedArg) {
    let text = '';
    let lang = '';

    if (typeof codeArg === 'object' && codeArg !== null) {
      text = codeArg.text || '';
      lang = codeArg.lang || '';
    } else {
      text = codeArg || '';
      lang = infostringArg || '';
    }

    if (lang === 'mermaid') {
      return `<div class="mermaid-container"><pre class="mermaid">${text}</pre></div>`;
    }
    
    if (text.includes('┌') && text.includes('└')) {
      return `<div class="ui-mockup-container"><pre class="ui-mockup"><code>${escapeHtml(text)}</code></pre></div>`;
    }

    return originalCodeRenderer.call(this, codeArg, infostringArg, escapedArg);
  };

  renderer.heading = function(text, level, raw, slugger) {
    const rawClean = raw ? raw.trim() : text;
    const slug = headingsMap.get(rawClean) || (slugger ? slugger.slug(raw) : `heading-${level}`);
    return `<h${level} id="${slug}">${text}</h${level}>`;
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
    /<h3>(.*?)<\/h3>\s*(<div class="ui-mockup-container">|<table|<div class="mermaid-container">|<ul|<ol)/g, 
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

  // 2. Merge options
  const mergedOptions = {
    theme: options.theme || frontMatter.theme || 'modern',
    font: options.font || frontMatter.font || 'Inter',
    pageSize: options.pageSize || frontMatter.pageSize || 'A4',
    orientation: options.orientation || frontMatter.orientation || (frontMatter.landscape ? 'landscape' : 'portrait'),
    margin: options.margin || frontMatter.margin || '14mm 12mm 16mm 12mm',
    toc: options.toc !== undefined ? options.toc : (frontMatter.toc || false),
    cover: options.cover !== undefined ? options.cover : (frontMatter.cover || false),
    header: options.header !== undefined ? options.header : (frontMatter.header || true),
    footer: options.footer !== undefined ? options.footer : (frontMatter.footer || true),
    mermaid: options.mermaid !== undefined ? options.mermaid : (frontMatter.mermaid !== false),
    katex: options.katex !== undefined ? options.katex : (frontMatter.katex !== false),
    customCss: options.customCss || '',
    cssFile: options.cssFile || frontMatter.cssFile || frontMatter.css
  };

  // 3. Preprocess Markdown (LaTeX, pagebreaks, alerts)
  const processedMd = preprocessMarkdown(markdownContent);

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
    cover: mergedOptions.cover
  });

  // 5. Read custom CSS file if specified
  let customCss = mergedOptions.customCss || '';
  if (mergedOptions.cssFile) {
    customCss += '\n' + readCustomCss(mergedOptions.cssFile);
  }

  // 6. Parse Markdown using custom renderer
  marked.setOptions({ gfm: true, breaks: true });
  const renderer = buildMarkedRenderer(headingsMap);
  marked.use({ renderer });

  let bodyHtml = marked.parse(processedMd);
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

  // 8. Generate and return full HTML template
  return getHtmlTemplate({
    title,
    author,
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
