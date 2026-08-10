// Content script for Markdown to PDF Converter

// Detect if current page is raw Markdown (e.g. Github raw view or .md file)
(function() {
  const isMdFile = window.location.pathname.endsWith('.md') || window.location.pathname.endsWith('.markdown');
  const isGithubRaw = window.location.hostname.includes('github') && window.location.pathname.includes('/raw/');

  if (isMdFile || isGithubRaw) {
    // Add floating button to page for 1-click PDF export
    const btn = document.createElement('button');
    btn.className = 'convert-md-to-pdf-floating-btn';
    btn.innerHTML = '📄 Convert to PDF';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      border: none;
      border-radius: 20px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      cursor: pointer;
      font-family: -apple-system, sans-serif;
      transition: transform 0.2s ease;
    `;

    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');

    btn.addEventListener('click', () => {
      const rawText = document.body.innerText;
      const title = document.title || 'Markdown_Document';

      chrome.runtime.sendMessage({
        action: "openPreview",
        markdown: rawText,
        title: title
      });
    });

    document.body.appendChild(btn);
  }
})();
