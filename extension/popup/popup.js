document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const btnClearFile = document.getElementById('btn-clear-file');
  const markdownInput = document.getElementById('markdown-input');
  const draftStatus = document.getElementById('draft-status');
  const btnGrabPage = document.getElementById('btn-grab-page');
  const historyList = document.getElementById('history-list');
  const themeSelect = document.getElementById('theme-select');
  const fontSelect = document.getElementById('font-select');
  const pageSizeSelect = document.getElementById('page-size');
  const chkToc = document.getElementById('chk-toc');
  const chkCover = document.getElementById('chk-cover');
  const chkMermaid = document.getElementById('chk-mermaid');
  const chkKatex = document.getElementById('chk-katex');
  const customCssInput = document.getElementById('custom-css-input');
  const btnConvert = document.getElementById('btn-convert');

  let loadedFileContent = null;
  let loadedFileName = 'Document';
  let saveDraftTimeout = null;

  // Load saved preferences & draft
  chrome.storage.sync.get(['theme', 'font', 'pageSize', 'toc', 'cover', 'mermaid', 'katex', 'customCss'], (items) => {
    if (items.theme) themeSelect.value = items.theme;
    if (items.font && fontSelect) fontSelect.value = items.font;
    if (items.pageSize) pageSizeSelect.value = items.pageSize;
    if (items.toc !== undefined) chkToc.checked = items.toc;
    if (items.cover !== undefined && chkCover) chkCover.checked = items.cover;
    if (items.mermaid !== undefined) chkMermaid.checked = items.mermaid;
    if (items.katex !== undefined) chkKatex.checked = items.katex;
    if (items.customCss) customCssInput.value = items.customCss;
  });

  // Restore Draft Markdown
  chrome.storage.local.get(['draftMarkdown', 'conversionHistory'], (data) => {
    if (data.draftMarkdown) {
      markdownInput.value = data.draftMarkdown;
      draftStatus.textContent = 'Draft restored';
    }
    renderHistory(data.conversionHistory || []);
  });

  // Draft Auto-Save on typing
  markdownInput.addEventListener('input', () => {
    draftStatus.textContent = 'Saving draft...';
    clearTimeout(saveDraftTimeout);
    saveDraftTimeout = setTimeout(() => {
      chrome.storage.local.set({ draftMarkdown: markdownInput.value }, () => {
        draftStatus.textContent = 'Draft saved';
      });
    }, 500);
  });

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // Drag & Drop File handling
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#38bdf8';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#334155';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#334155';
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  btnClearFile.addEventListener('click', () => {
    loadedFileContent = null;
    loadedFileName = 'Document';
    fileInput.value = '';
    fileInfo.style.display = 'none';
    dropZone.style.display = 'block';
  });

  function handleFiles(files) {
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        loadedFileContent = event.target.result;
        loadedFileName = file.name.replace(/\.[^/.]+$/, "");
        fileName.textContent = file.name;
        dropZone.style.display = 'none';
        fileInfo.style.display = 'flex';
      };
      reader.readAsText(file);
    } else {
      const fileArray = Array.from(files);
      const readPromises = fileArray.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, text: e.target.result });
          reader.readAsText(file);
        });
      });

      Promise.all(readPromises).then(results => {
        loadedFileContent = results.map(r => `# ${r.name.replace(/\.[^/.]+$/, "")}\n\n${r.text}`).join('\n\n<!-- pagebreak -->\n\n');
        loadedFileName = `Batch_${results.length}_Documents`;
        fileName.textContent = `📦 ${results.length} files loaded`;
        dropZone.style.display = 'none';
        fileInfo.style.display = 'flex';
      });
    }
  }

  // Grab Current Page Content
  btnGrabPage.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      }, (results) => {
        if (results && results[0] && results[0].result) {
          markdownInput.value = results[0].result;
          loadedFileName = tab.title ? tab.title.replace(/[^\w\s-]/gi, '') : 'Page_Export';
          // Save draft
          chrome.storage.local.set({ draftMarkdown: markdownInput.value });
          // Switch to paste tab
          tabBtns[1].click();
        }
      });
    } catch (err) {
      alert('Could not grab page content: ' + err.message);
    }
  });

  // Render History List
  function renderHistory(historyItems) {
    if (!historyItems || historyItems.length === 0) {
      historyList.innerHTML = '<p class="history-empty">No recent conversions found.</p>';
      return;
    }

    historyList.innerHTML = '';
    historyItems.forEach((item, index) => {
      const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div>
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-meta">${dateStr} • Theme: ${item.options.theme}</div>
        </div>
        <button class="btn-clear" title="Re-open preview">▶</button>
      `;
      div.addEventListener('click', () => {
        openPreview(item.markdown, item.title, item.options);
      });
      historyList.appendChild(div);
    });
  }

  function saveHistoryItem(item) {
    chrome.storage.local.get(['conversionHistory'], (data) => {
      let history = data.conversionHistory || [];
      // Remove duplicate if same title exists
      history = history.filter(h => h.title !== item.title);
      // Prepend new item
      history.unshift(item);
      // Limit to 10 items
      if (history.length > 10) history = history.slice(0, 10);

      chrome.storage.local.set({ conversionHistory: history });
    });
  }

  // Convert & Open Preview
  btnConvert.addEventListener('click', () => {
    let activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    let markdownText = '';
    let title = loadedFileName;

    if (activeTab === 'upload' && loadedFileContent) {
      markdownText = loadedFileContent;
    } else if (activeTab === 'paste' || activeTab === 'page') {
      markdownText = markdownInput.value.trim();
    } else if (loadedFileContent) {
      markdownText = loadedFileContent;
    } else if (markdownInput.value.trim()) {
      markdownText = markdownInput.value.trim();
    }

    if (!markdownText) {
      alert('Please select a file, paste Markdown text, or grab a page first.');
      return;
    }

    const conversionOptions = {
      theme: themeSelect.value,
      font: fontSelect ? fontSelect.value : 'Inter',
      pageSize: pageSizeSelect.value,
      toc: chkToc.checked,
      cover: chkCover ? chkCover.checked : false,
      mermaid: chkMermaid.checked,
      katex: chkKatex.checked,
      customCss: customCssInput.value
    };

    // Save preferences
    chrome.storage.sync.set(conversionOptions);

    // Save history item
    saveHistoryItem({
      title,
      markdown: markdownText,
      options: conversionOptions,
      timestamp: Date.now()
    });

    openPreview(markdownText, title, conversionOptions);
  });

  function openPreview(markdown, title, options) {
    chrome.storage.local.set({
      pendingMarkdown: markdown,
      pendingTitle: title,
      pendingOptions: options
    }, () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('preview/preview.html')
      });
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
