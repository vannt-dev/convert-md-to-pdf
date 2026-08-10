// Background Service Worker for Markdown to PDF Converter Extension

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for selected text
  chrome.contextMenus.create({
    id: "convert-selection-to-pdf",
    title: "Convert selected text to PDF",
    contexts: ["selection"]
  });

  // Create context menu for page
  chrome.contextMenus.create({
    id: "convert-page-to-pdf",
    title: "Convert Markdown page to PDF",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "convert-selection-to-pdf" && info.selectionText) {
    openPreviewWithMarkdown(info.selectionText, "Selection_Export");
  } else if (info.menuItemId === "convert-page-to-pdf" && tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const title = tab.title ? tab.title.replace(/[^\w\s-]/gi, '') : 'Page_Export';
        openPreviewWithMarkdown(results[0].result, title);
      }
    });
  }
});

function openPreviewWithMarkdown(markdownText, title = 'Document') {
  chrome.storage.local.set({
    pendingMarkdown: markdownText,
    pendingTitle: title
  }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("preview/preview.html")
    });
  });
}

// Handle runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openPreview") {
    openPreviewWithMarkdown(request.markdown, request.title || 'Document');
    sendResponse({ status: "ok" });
  }
  return true;
});
