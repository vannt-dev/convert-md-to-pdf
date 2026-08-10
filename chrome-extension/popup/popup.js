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
  const btnGrabPage = document.getElementById('btn-grab-page');
  const themeSelect = document.getElementById('theme-select');
  const pageSizeSelect = document.getElementById('page-size');
  const chkMermaid = document.getElementById('chk-mermaid');
  const chkKatex = document.getElementById('chk-katex');
  const btnConvert = document.getElementById('btn-convert');

  let loadedFileContent = null;
  let loadedFileName = 'Document';

  // Load saved preferences
  chrome.storage.sync.get(['theme', 'pageSize', 'mermaid', 'katex'], (items) => {
    if (items.theme) themeSelect.value = items.theme;
    if (items.pageSize) pageSizeSelect.value = items.pageSize;
    if (items.mermaid !== undefined) chkMermaid.checked = items.mermaid;
    if (items.katex !== undefined) chkKatex.checked = items.katex;
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  btnClearFile.addEventListener('click', () => {
    loadedFileContent = null;
    loadedFileName = 'Document';
    fileInput.value = '';
    fileInfo.style.display = 'none';
    dropZone.style.display = 'block';
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      loadedFileContent = event.target.result;
      loadedFileName = file.name.replace(/\.[^/.]+$/, "");
      fileName.textContent = file.name;
      dropZone.style.display = 'none';
      fileInfo.style.display = 'flex';
    };
    reader.readAsText(file);
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
          // Switch to paste tab to show content
          tabBtns[1].click();
        }
      });
    } catch (err) {
      alert('Could not grab page content: ' + err.message);
    }
  });

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
    }

    if (!markdownText) {
      alert('Please select a file, paste Markdown text, or grab a page first.');
      return;
    }

    // Save preferences
    chrome.storage.sync.set({
      theme: themeSelect.value,
      pageSize: pageSizeSelect.value,
      mermaid: chkMermaid.checked,
      katex: chkKatex.checked
    });

    // Save markdown & conversion settings to local storage
    chrome.storage.local.set({
      pendingMarkdown: markdownText,
      pendingTitle: title,
      pendingOptions: {
        theme: themeSelect.value,
        pageSize: pageSizeSelect.value,
        mermaid: chkMermaid.checked,
        katex: chkKatex.checked
      }
    }, () => {
      // Open preview tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('preview/preview.html')
      });
    });
  });
});
