const { getThemeStyles } = require('./themes');

/**
 * Escapes special XML characters in title/metadata
 * @param {string} str 
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return 'Document';
  return str.replace(/[<>&'"]/g, '');
}

/**
 * Returns complete HTML document template with injected body, CSS, fonts, and scripts
 * @param {Object} params
 * @param {string} params.title Document title
 * @param {string} [params.author] Document author
 * @param {string} params.bodyHtml Document body HTML
 * @param {Object} [params.options] Template options
 * @returns {string} Full HTML string
 */
function getHtmlTemplate({ title, author = '', bodyHtml, options = {} }) {
  const theme = options.theme || 'modern';
  const enableMermaid = options.mermaid !== false;
  const enableKatex = options.katex !== false;
  const pageSize = options.pageSize || 'A4';
  const orientation = options.orientation || 'portrait';
  const margin = options.margin || '14mm 12mm 16mm 12mm';
  const customCss = options.customCss || '';

  const themeStyles = getThemeStyles(theme, options.font);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeXml(title)}</title>
  
  <!-- 
    Google Fonts Integration - Verified Open Source Licensing:
    - Inter: SIL Open Font License 1.1 (100% Free / Open Source)
    - Roboto: Apache License 2.0 (100% Free / Open Source)
    - JetBrains Mono: SIL Open Font License 1.1 (100% Free / Open Source)
    - Fira Code: SIL Open Font License 1.1 (100% Free / Open Source)
    - Merriweather: SIL Open Font License 1.1 (100% Free / Open Source)
    - Lora: SIL Open Font License 1.1 (100% Free / Open Source)
    - Noto Sans JP: SIL Open Font License 1.1 (100% Free / Open Source)
  -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  
  ${enableKatex ? `
  <!-- KaTeX for math rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="if(typeof renderMathInElement==='function'){renderMathInElement(document.body);}"></script>
  ` : ''}

  ${enableMermaid ? `
  <!-- Mermaid.js for diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
          startOnLoad: true,
          theme: '${theme === 'dark' ? 'dark' : 'base'}',
          securityLevel: 'loose',
          wrap: true,
          useMaxWidth: true,
          fontFamily: 'Inter, sans-serif',
          sequence: {
            useMaxWidth: true,
            wrap: true,
            boxMargin: 10,
            noteMargin: 10,
            messageMargin: 35
          }
        });
      }
    });
  </script>
  ` : ''}

  <style>
    @page {
      size: ${pageSize} ${orientation};
      margin: ${margin};
    }

    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .page-break {
      break-after: page;
      page-break-after: always;
    }

    img {
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain;
    }

    input[type="checkbox"] {
      -webkit-appearance: checkbox !important;
      appearance: checkbox !important;
      display: inline-block !important;
      width: 14px !important;
      height: 14px !important;
      margin: 0 4px 0 0 !important;
      vertical-align: middle !important;
    }

    ${themeStyles}

    /* Table of Contents Container & Dotted Leader Lines */
    .toc-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      border-radius: 6px;
      padding: 14px 18px;
      margin: 16px 0 24px 0;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }

    .toc-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 10px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
    }

    .toc-list {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }

    .toc-list li {
      margin-bottom: 6px;
      font-size: 13px;
    }

    .toc-list a {
      display: flex;
      align-items: baseline;
      color: #2563eb;
      text-decoration: none;
    }

    .toc-item-title {
      flex-shrink: 0;
      max-width: 80%;
    }

    .toc-item-dots {
      flex-grow: 1;
      border-bottom: 1px dotted #94a3b8;
      margin: 0 8px;
      align-self: center;
    }

    .toc-list a:hover {
      text-decoration: underline;
    }

    .toc-item-h1 { font-weight: 600; padding-left: 0; }
    .toc-item-h2 { padding-left: 16px; }
    .toc-item-h3 { padding-left: 32px; font-size: 12px; color: #64748b; }

    /* Custom Injected CSS */
    ${customCss}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

module.exports = {
  getHtmlTemplate,
  getThemeStyles
};
