/**
 * Returns HTML document template with injected body, CSS, fonts, and scripts
 */
function getHtmlTemplate({ title, bodyHtml, options = {} }) {
  const theme = options.theme || 'modern';
  const enableMermaid = options.mermaid !== false;
  const enableKatex = options.katex !== false;
  const pageSize = options.pageSize || 'A4';
  const orientation = options.orientation || 'portrait';
  const margin = options.margin || '14mm 12mm 16mm 12mm';

  const themeStyles = getThemeStyles(theme);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeXml(title)}</title>
  
  <!-- Google Fonts for UTF-8 / CJK / Vietnamese typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  
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
          themeVariables: {
            primaryColor: '#e0f2fe',
            primaryBorderColor: '#0284c7',
            primaryTextColor: '#0f172a',
            lineColor: '#0284c7',
            textColor: '#1e293b',
            actorBkg: '#1e293b',
            actorTextColor: '#ffffff',
            actorLineColor: '#475569',
            signalColor: '#0f172a',
            signalTextColor: '#0f172a',
            labelBoxBkgColor: '#f8fafc',
            labelBoxBorderColor: '#cbd5e1',
            labelTextColor: '#0f172a',
            loopTextColor: '#0f172a',
            noteBkgColor: '#fef3c7',
            noteTextColor: '#78350f',
            noteBorderColor: '#f59e0b',
            fontSize: '13px'
          },
          sequence: {
            diagramMarginX: 10,
            diagramMarginY: 10,
            actorMargin: 15,
            width: 130,
            height: 38,
            boxMargin: 8,
            boxTextMargin: 4,
            noteMargin: 8,
            messageMargin: 12,
            useMaxWidth: true
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

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    ${themeStyles}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function escapeXml(str) {
  if (!str) return 'Document';
  return str.replace(/[<>&'"]/g, '');
}

function getThemeStyles(theme) {
  switch (theme) {
    case 'dark':
      return `
        body {
          font-family: 'Inter', 'Noto Sans JP', sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #e2e8f0;
          background-color: #0f172a;
          padding: 10px;
        }
        h1 { font-size: 21px; color: #f8fafc; border-bottom: 3px solid #38bdf8; padding-bottom: 8px; break-after: avoid-page; }
        h2 { font-size: 16px; color: #38bdf8; background: #1e293b; border-left: 5px solid #38bdf8; padding: 6px 12px; border-radius: 0 4px 4px 0; break-after: avoid-page; }
        h3 { font-size: 14.5px; color: #7dd3fc; border-bottom: 1px solid #334155; padding-bottom: 4px; break-after: avoid-page; }
        blockquote { background: #1e293b; border-left: 4px solid #38bdf8; color: #cbd5e1; padding: 10px 16px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        tr { break-inside: avoid-page; }
        th { background: #1e293b; color: #38bdf8; padding: 8px; border: 1px solid #334155; }
        td { padding: 7px; border: 1px solid #334155; }
        tbody tr:nth-child(even) { background: #1e293b; }
        code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: #1e293b; color: #f8fafc; padding: 2px 6px; border-radius: 3px; border: 1px solid #334155; }
        pre { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; background: #020617; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
        .formula-box { background: #1e293b; border: 1px solid #38bdf8; padding: 10px 16px; border-radius: 4px; text-align: center; color: #38bdf8; }
        .ui-mockup-container { margin: 12px 0; break-inside: avoid-page; }
        .ui-mockup { background-color: #1e1e2e; color: #a6adc8; border: 1px solid #313244; border-left: 4px solid #89b4fa; }
        .mermaid-container { display: flex; justify-content: center; margin: 14px 0; background: #1e293b; padding: 12px; border-radius: 6px; break-inside: avoid-page; }
      `;

    case 'academic':
      return `
        body {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 12px;
          line-height: 1.7;
          color: #111827;
          background-color: #ffffff;
          padding: 10px;
        }
        h1 { font-size: 20px; color: #111827; border-bottom: 2px solid #111827; padding-bottom: 6px; break-after: avoid-page; font-weight: 700; text-align: center; }
        h2 { font-size: 15px; color: #1f2937; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-top: 20px; break-after: avoid-page; }
        h3 { font-size: 13.5px; color: #374151; font-style: italic; break-after: avoid-page; }
        blockquote { font-style: italic; border-left: 3px solid #6b7280; padding-left: 14px; margin: 12px 0; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11.5px; }
        tr { break-inside: avoid-page; }
        th { background: #f3f4f6; color: #111827; padding: 6px; border: 1px solid #9ca3af; font-weight: 700; }
        td { padding: 6px; border: 1px solid #d1d5db; }
        code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #f3f4f6; padding: 2px 4px; border-radius: 2px; }
        pre { font-family: 'JetBrains Mono', monospace; font-size: 10px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; break-inside: avoid-page; }
        .formula-box { background: #f9fafb; border: 1px solid #d1d5db; padding: 8px 14px; border-radius: 4px; text-align: center; font-style: italic; }
        .mermaid-container { display: flex; justify-content: center; margin: 14px 0; background: #ffffff; padding: 8px; border: 1px solid #e5e7eb; break-inside: avoid-page; }
      `;

    case 'minimal':
      return `
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          color: #000000;
          background-color: #ffffff;
          padding: 10px;
        }
        h1 { font-size: 20px; font-weight: 700; border-bottom: 2px solid #000; padding-bottom: 4px; break-after: avoid-page; }
        h2 { font-size: 15px; font-weight: 700; margin-top: 18px; break-after: avoid-page; }
        h3 { font-size: 13.5px; font-weight: 600; break-after: avoid-page; }
        blockquote { border-left: 3px solid #000; padding-left: 12px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        tr { break-inside: avoid-page; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background: #f2f2f2; font-weight: 700; }
        code { font-family: monospace; font-size: 11px; background: #f2f2f2; padding: 2px 4px; }
        pre { font-family: monospace; font-size: 10.5px; background: #f9f9f9; border: 1px solid #ccc; padding: 10px; break-inside: avoid-page; }
        .formula-box { border: 1px solid #000; padding: 8px; text-align: center; margin: 10px 0; }
        .mermaid-container { display: flex; justify-content: center; margin: 12px 0; border: 1px solid #ccc; padding: 8px; break-inside: avoid-page; }
      `;

    case 'modern':
    default:
      return `
        body {
          font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.55;
          color: #1e293b;
          background-color: #ffffff;
          margin: 0;
          padding: 10px;
        }
        h1 {
          font-size: 21px;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 8px;
          margin-top: 0;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          break-after: avoid-page;
          page-break-after: avoid;
        }
        h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1e3a8a;
          background: #eff6ff;
          border-left: 5px solid #2563eb;
          padding: 6px 12px;
          margin-top: 22px;
          margin-bottom: 12px;
          border-radius: 0 4px 4px 0;
          break-after: avoid-page;
          page-break-after: avoid;
        }
        h3 {
          font-size: 14.5px;
          font-weight: 600;
          color: #1e40af;
          margin-top: 16px;
          margin-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          break-after: avoid-page;
          page-break-after: avoid;
        }
        h4 {
          font-size: 13.5px;
          font-weight: 600;
          color: #334155;
          margin-top: 12px;
          margin-bottom: 6px;
          break-after: avoid-page;
          page-break-after: avoid;
        }
        .section-group {
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .formula-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-left: 4px solid #0284c7;
          padding: 10px 16px;
          border-radius: 4px;
          margin: 12px 0;
          font-size: 13.5px;
          color: #0369a1;
          text-align: center;
        }
        .formula-box span {
          font-weight: 500;
          background: #ffffff;
          padding: 2px 8px;
          border-radius: 3px;
          border: 1px solid #e0f2fe;
        }
        blockquote {
          margin: 12px 0;
          padding: 10px 16px;
          background-color: #f8fafc;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
          color: #334155;
          font-size: 12.5px;
        }
        blockquote p { margin: 4px 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 12px;
          break-inside: auto;
        }
        tr { break-inside: avoid-page; page-break-inside: avoid; }
        th {
          background-color: #1e293b;
          color: #ffffff;
          font-weight: 600;
          text-align: left;
          padding: 7px 9px;
          border: 1px solid #334155;
          font-size: 11.5px;
          letter-spacing: 0.2px;
        }
        td { padding: 6px 9px; border: 1px solid #cbd5e1; vertical-align: top; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        code {
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
          font-size: 11.5px;
          background-color: #f1f5f9;
          color: #0f172a;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid #e2e8f0;
        }
        pre {
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
          font-size: 10.5px;
          line-height: 1.4;
          background-color: #0f172a;
          color: #f8fafc;
          padding: 10px 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 10px 0;
          white-space: pre-wrap;
          word-break: break-all;
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        pre code { background: none; color: inherit; padding: 0; border: none; font-size: inherit; }
        .ui-mockup-container { margin: 12px 0; break-inside: avoid-page; page-break-inside: avoid; }
        .ui-mockup {
          background-color: #1e1e2e;
          color: #a6adc8;
          border: 1px solid #313244;
          border-left: 4px solid #89b4fa;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .ui-mockup code { color: #cdd6f4; }
        .mermaid-container {
          display: flex;
          justify-content: center;
          margin: 14px 0;
          background-color: #ffffff;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .mermaid { width: 100%; text-align: center; }
        .mermaid svg { max-width: 100% !important; height: auto !important; }
        hr { border: 0; height: 1px; background: #e2e8f0; margin: 16px 0; }
        ul, ol { padding-left: 20px; margin: 6px 0; }
        li { margin-bottom: 3px; }
        strong { color: #0f172a; }
        a { color: #2563eb; text-decoration: none; }
      `;
  }
}

module.exports = {
  getHtmlTemplate
};
