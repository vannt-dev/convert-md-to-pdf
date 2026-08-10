const { marked } = require('marked');
const { preprocessMarkdown, generateToc, readCustomCss, escapeHtml } = require('./utils');
const { getHtmlTemplate } = require('./templates');

/**
 * Converts Markdown content into a fully styled HTML string
 * @param {string} markdownContent 
 * @param {Object} options 
 * @returns {string} HTML string
 */
function parseMarkdownToHtml(markdownContent, options = {}) {
  // Preprocess LaTeX math & symbols
  const processedMd = preprocessMarkdown(markdownContent);

  // Generate TOC if enabled
  let tocHtml = '';
  let headingsMap = new Map();
  if (options.toc) {
    const tocResult = generateToc(processedMd);
    tocHtml = tocResult.tocHtml;
    headingsMap = tocResult.headingsMap;
  }

  // Read custom CSS if file path supplied
  let customCss = options.customCss || '';
  if (options.cssFile) {
    customCss += '\n' + readCustomCss(options.cssFile);
  }

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true
  });

  // Custom renderer for code blocks, diagrams & heading IDs
  const renderer = new marked.Renderer();
  const originalCodeRenderer = renderer.code.bind(renderer);
  const originalHeadingRenderer = renderer.heading.bind(renderer);

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
    
    // Check if code block contains ASCII UI mockups (box drawing characters)
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

  marked.use({ renderer });

  // Parse Markdown to Body HTML
  let bodyHtml = marked.parse(processedMd);

  // Insert TOC after first H1 or at the top
  if (tocHtml) {
    if (bodyHtml.includes('</h1>')) {
      bodyHtml = bodyHtml.replace('</h1>', '</h1>\n' + tocHtml);
    } else {
      bodyHtml = tocHtml + bodyHtml;
    }
  }

  // Wrap section headers with section-group divs for optimal page breaking
  bodyHtml = bodyHtml.replace(/<h3>(.*?)<\/h3>\s*(<div class="ui-mockup-container">|<table|<div class="mermaid-container">|<ul|<ol)/g, 
    '<div class="section-group"><h3>$1</h3>$2');
  bodyHtml = bodyHtml.replace(/(<\/table>|<\/div>|<\/ul>|<\/ol>)\s*(?=<h[1-4]>|<hr|\$)/g, '$1</div>');

  // Extract title from H1 if present
  const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Converted Document';

  // Generate full HTML template
  return getHtmlTemplate({
    title,
    bodyHtml,
    options: {
      ...options,
      customCss
    }
  });
}

module.exports = {
  parseMarkdownToHtml
};
