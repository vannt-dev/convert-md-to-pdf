document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('content');
  const themeSelect = document.getElementById('preview-theme');
  const pageSizeSelect = document.getElementById('preview-size');
  const btnPrint = document.getElementById('btn-trigger-print');
  const themeStyleEl = document.getElementById('theme-style');

  chrome.storage.local.get(['pendingMarkdown', 'pendingTitle', 'pendingOptions'], (data) => {
    if (!data.pendingMarkdown) {
      contentEl.innerHTML = '<p style="padding:20px; color:#64748b;">No pending document found. Please open from extension popup.</p>';
      return;
    }

    const markdownText = data.pendingMarkdown;
    const title = data.pendingTitle || 'Document';
    const options = data.pendingOptions || {};

    document.title = title;

    if (options.theme) themeSelect.value = options.theme;
    if (options.pageSize) pageSizeSelect.value = options.pageSize;

    // Apply theme CSS & render
    renderDocument(markdownText, options);

    // Event listeners
    themeSelect.addEventListener('change', () => {
      options.theme = themeSelect.value;
      renderDocument(markdownText, options);
    });

    pageSizeSelect.addEventListener('change', () => {
      options.pageSize = pageSizeSelect.value;
      renderDocument(markdownText, options);
    });

    btnPrint.addEventListener('click', () => {
      window.print();
    });
  });

  function renderDocument(markdownText, options) {
    // Apply CSS theme styles
    themeStyleEl.textContent = getThemeStyles(options.theme || 'modern', options.pageSize || 'A4', options.customCss || '');

    // Preprocess LaTeX & Symbols
    const processedMd = preprocessMarkdown(markdownText);

    // Generate TOC if requested
    let tocHtml = '';
    let headingsMap = new Map();
    if (options.toc) {
      const tocResult = generateToc(processedMd);
      tocHtml = tocResult.tocHtml;
      headingsMap = tocResult.headingsMap;
    }

    // Configure marked renderer
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

      if (lang === 'mermaid' && options.mermaid !== false) {
        return `<div class="mermaid-container"><pre class="mermaid">${escapeHtml(text)}</pre></div>`;
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

    marked.use({ renderer });

    // Parse HTML
    let bodyHtml = marked.parse(processedMd);

    // Insert TOC
    if (tocHtml) {
      if (bodyHtml.includes('</h1>')) {
        bodyHtml = bodyHtml.replace('</h1>', '</h1>\n' + tocHtml);
      } else {
        bodyHtml = tocHtml + bodyHtml;
      }
    }

    // Wrap sections for page break
    bodyHtml = bodyHtml.replace(/<h3>(.*?)<\/h3>\s*(<div class="ui-mockup-container">|<table|<div class="mermaid-container">|<ul|<ol)/g, 
      '<div class="section-group"><h3>$1</h3>$2');
    bodyHtml = bodyHtml.replace(/(<\/table>|<\/div>|<\/ul>|<\/ol>)\s*(?=<h[1-4]>|<hr|\$)/g, '$1</div>');

    contentEl.innerHTML = bodyHtml;

    // Render KaTeX Math if enabled
    if (options.katex !== false && typeof katex !== 'undefined') {
      renderKaTeXMath(contentEl);
    }

    // Render Mermaid Diagrams if enabled
    if (options.mermaid !== false && typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: options.theme === 'dark' ? 'dark' : 'base',
          themeVariables: {
            primaryColor: '#e0f2fe',
            primaryBorderColor: '#0284c7',
            primaryTextColor: '#0f172a',
            lineColor: '#0284c7',
            textColor: '#1e293b',
            actorBkg: '#1e293b',
            actorTextColor: '#ffffff',
            fontSize: '13px'
          }
        });
        mermaid.run({ nodes: contentEl.querySelectorAll('.mermaid') });
      } catch (err) {
        console.error('Mermaid render error:', err);
      }
    }
  }

  function preprocessMarkdown(mdContent) {
    if (!mdContent) return '';
    return mdContent
      .replace(/\\longrightarrow/g, '⟶')
      .replace(/\\rightarrow/g, '→')
      .replace(/\$→\$/g, '→')
      .replace(/\$\\rightarrow\$/g, '→')
      .replace(/\$\\longrightarrow\$/g, '⟶')
      .replace(/\$\\ge\$/g, '≥')
      .replace(/\$\\le\$/g, '≤')
      .replace(/\$x\/y\$/g, 'x/y')
      .replace(/\$x < y\$/g, 'x < y')
      .replace(/\$x = y\$/g, 'x = y')
      .replace(/\$\$\s*\\text\{([^}]+)\}\s*=\s*\\text\{([^}]+)\}\s*-\s*\\text\{([^}]+)\}\s*\$\$/g, 
        '<div class="formula-box"><strong>$1</strong> = <span>$2</span> &minus; <span>$3</span></div>')
      .replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<div class="formula-box">$1</div>');
  }

  function generateToc(mdContent) {
    if (!mdContent) return { tocHtml: '', headingsMap: new Map() };
    const lines = mdContent.split('\n');
    const headings = [];
    const headingsMap = new Map();
    const slugCounts = {};

    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        let title = match[2].trim();
        title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*+/g, '');

        let slug = title.toLowerCase().replace(/[^\w\u00C0-\u024F\u1EA0-\u1EF9]+/g, '-').replace(/^-+|-+$/g, '');
        if (!slug) slug = `heading-${headings.length + 1}`;

        if (slugCounts[slug]) {
          slugCounts[slug]++;
          slug = `${slug}-${slugCounts[slug]}`;
        } else {
          slugCounts[slug] = 1;
        }

        headings.push({ level, title, slug });
        headingsMap.set(match[2].trim(), slug);
      }
    });

    if (headings.length === 0) return { tocHtml: '', headingsMap };

    let tocHtml = `<div class="toc-container">
      <div class="toc-title">📋 Table of Contents</div>
      <ul class="toc-list">\n`;

    headings.forEach(h => {
      const indentClass = `toc-item-h${h.level}`;
      tocHtml += `        <li class="${indentClass}"><a href="#${h.slug}">${escapeHtml(h.title)}</a></li>\n`;
    });

    tocHtml += `      </ul>\n    </div>\n`;

    return { tocHtml, headingsMap };
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderKaTeXMath(element) {
    const nodes = element.querySelectorAll('p, li, td, th, h1, h2, h3, h4');
    nodes.forEach(node => {
      if (node.children.length === 0 && node.textContent.includes('$')) {
        const text = node.textContent;
        const replaced = text.replace(/\$([^\$\s](?:[^\$]*[^\$\s])?)\$/g, (match, expr) => {
          if (/^\d+(\.\d+)?$/.test(expr)) return match;
          try {
            return katex.renderToString(expr, { throwOnError: false });
          } catch (e) {
            return match;
          }
        });
        if (replaced !== text) {
          node.innerHTML = replaced;
        }
      }
    });
  }

  function getThemeStyles(theme, pageSize, customCss = '') {
    const pageCss = `@page { size: ${pageSize} portrait; margin: 14mm 12mm 16mm 12mm; }`;
    let styles = '';

    const tocCss = `
      .toc-container { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 6px; padding: 14px 18px; margin: 16px 0 24px 0; break-inside: avoid-page; }
      .toc-title { font-size: 15px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
      .toc-list { list-style: none; padding-left: 0; margin: 0; }
      .toc-list li { margin-bottom: 4px; font-size: 13px; }
      .toc-list a { color: #2563eb; text-decoration: none; }
      .toc-list a:hover { text-decoration: underline; }
      .toc-item-h1 { font-weight: 600; padding-left: 0; }
      .toc-item-h2 { padding-left: 16px; }
      .toc-item-h3 { padding-left: 32px; font-size: 12px; color: #64748b; }
    `;

    if (theme === 'dark') {
      styles = `
        body { background: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; font-size: 13px; }
        #document-container { background: #0f172a; color: #e2e8f0; }
        h1 { color: #f8fafc; border-bottom: 3px solid #38bdf8; padding-bottom: 8px; break-after: avoid-page; }
        h2 { color: #38bdf8; background: #1e293b; border-left: 5px solid #38bdf8; padding: 6px 12px; border-radius: 0 4px 4px 0; break-after: avoid-page; }
        h3 { color: #7dd3fc; border-bottom: 1px solid #334155; padding-bottom: 4px; break-after: avoid-page; }
        blockquote { background: #1e293b; border-left: 4px solid #38bdf8; color: #cbd5e1; padding: 10px 16px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        tr { break-inside: avoid-page; }
        th { background: #1e293b; color: #38bdf8; padding: 8px; border: 1px solid #334155; }
        td { padding: 7px; border: 1px solid #334155; }
        code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: #1e293b; color: #f8fafc; padding: 2px 5px; border-radius: 3px; }
        pre { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; background: #020617; color: #f8fafc; padding: 12px; border-radius: 6px; break-inside: avoid-page; }
        .formula-box { background: #1e293b; border: 1px solid #38bdf8; padding: 10px; text-align: center; color: #38bdf8; border-radius: 4px; }
        .ui-mockup { background-color: #1e1e2e; color: #a6adc8; border: 1px solid #313244; border-left: 4px solid #89b4fa; }
        .mermaid-container { display: flex; justify-content: center; margin: 14px 0; background: #1e293b; padding: 12px; border-radius: 6px; break-inside: avoid-page; }
      `;
    } else if (theme === 'academic') {
      styles = `
        body { font-family: 'Merriweather', Georgia, serif; font-size: 12px; line-height: 1.7; color: #111827; }
        h1 { font-size: 20px; color: #111827; border-bottom: 2px solid #111827; padding-bottom: 6px; break-after: avoid-page; text-align: center; }
        h2 { font-size: 15px; color: #1f2937; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-top: 20px; break-after: avoid-page; }
        h3 { font-size: 13.5px; color: #374151; font-style: italic; break-after: avoid-page; }
        blockquote { font-style: italic; border-left: 3px solid #6b7280; padding-left: 14px; margin: 12px 0; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11.5px; }
        tr { break-inside: avoid-page; }
        th { background: #f3f4f6; color: #111827; padding: 6px; border: 1px solid #9ca3af; font-weight: 700; }
        td { padding: 6px; border: 1px solid #d1d5db; }
        code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #f3f4f6; padding: 2px 4px; }
        pre { font-family: 'JetBrains Mono', monospace; font-size: 10px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; break-inside: avoid-page; }
        .formula-box { background: #f9fafb; border: 1px solid #d1d5db; padding: 8px 14px; text-align: center; font-style: italic; }
        .mermaid-container { display: flex; justify-content: center; margin: 14px 0; background: #ffffff; padding: 8px; border: 1px solid #e5e7eb; break-inside: avoid-page; }
      `;
    } else if (theme === 'minimal') {
      styles = `
        body { font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.5; color: #000; }
        h1 { font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 4px; break-after: avoid-page; }
        h2 { font-size: 15px; margin-top: 18px; break-after: avoid-page; }
        h3 { font-size: 13.5px; break-after: avoid-page; }
        blockquote { border-left: 3px solid #000; padding-left: 12px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        tr { break-inside: avoid-page; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background: #f2f2f2; }
        code { font-family: monospace; font-size: 11px; background: #f2f2f2; padding: 2px 4px; }
        pre { font-family: monospace; font-size: 10.5px; background: #f9f9f9; border: 1px solid #ccc; padding: 10px; break-inside: avoid-page; }
        .formula-box { border: 1px solid #000; padding: 8px; text-align: center; margin: 10px 0; }
        .mermaid-container { display: flex; justify-content: center; margin: 12px 0; border: 1px solid #ccc; padding: 8px; break-inside: avoid-page; }
      `;
    } else {
      styles = `
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; font-size: 13px; line-height: 1.55; color: #1e293b; }
        h1 { font-size: 21px; font-weight: 700; color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 8px; text-transform: uppercase; break-after: avoid-page; }
        h2 { font-size: 16px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border-left: 5px solid #2563eb; padding: 6px 12px; border-radius: 0 4px 4px 0; break-after: avoid-page; }
        h3 { font-size: 14.5px; font-weight: 600; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; break-after: avoid-page; }
        h4 { font-size: 13.5px; font-weight: 600; color: #334155; break-after: avoid-page; }
        .formula-box { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; padding: 10px 16px; border-radius: 4px; margin: 12px 0; font-size: 13.5px; color: #0369a1; text-align: center; }
        .formula-box span { font-weight: 500; background: #ffffff; padding: 2px 8px; border-radius: 3px; border: 1px solid #e0f2fe; }
        blockquote { margin: 12px 0; padding: 10px 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; color: #334155; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        tr { break-inside: avoid-page; }
        th { background-color: #1e293b; color: #ffffff; padding: 7px 9px; border: 1px solid #334155; }
        td { padding: 6px 9px; border: 1px solid #cbd5e1; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background-color: #f1f5f9; color: #0f172a; padding: 1px 5px; border-radius: 3px; border: 1px solid #e2e8f0; }
        pre { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; background-color: #0f172a; color: #f8fafc; padding: 10px 12px; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
        pre code { background: none; color: inherit; border: none; padding: 0; }
        .ui-mockup-container { margin: 12px 0; break-inside: avoid-page; }
        .ui-mockup { background-color: #1e1e2e; color: #a6adc8; border: 1px solid #313244; border-left: 4px solid #89b4fa; }
        .ui-mockup code { color: #cdd6f4; }
        .mermaid-container { display: flex; justify-content: center; margin: 14px 0; background-color: #ffffff; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; break-inside: avoid-page; }
        .mermaid svg { max-width: 100% !important; height: auto !important; }
      `;
    }

    return pageCss + '\n' + styles + '\n' + tocCss + '\n' + customCss;
  }
});
