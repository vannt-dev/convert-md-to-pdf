const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

/**
 * Finds available Chrome or Edge binary path on system
 * @returns {string|null}
 */
function findBrowserExecutable() {
  const platform = os.platform();
  const candidates = [];

  if (platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');

    candidates.push(
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    // Linux / Unix
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/microsoft-edge',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  for (const binPath of candidates) {
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }

  return null;
}

/**
 * Renders HTML file to PDF using headless browser
 * @param {string} htmlPath 
 * @param {string} outputPath 
 * @param {Object} options 
 * @returns {Promise<string>}
 */
function renderHtmlToPdf(htmlPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const browserPath = options.executablePath || findBrowserExecutable();

    if (!browserPath) {
      return reject(new Error('No installed Chromium browser (Edge/Chrome) was found on your system. Please install Microsoft Edge or Google Chrome.'));
    }

    const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      '--virtual-time-budget=8000',
      `--print-to-pdf=${outputPath}`,
      fileUrl
    ];

    execFile(browserPath, args, { timeout: 30000 }, (error) => {
      if (error) {
        // Fallback for older chrome versions that don't support --headless=new
        const fallbackArgs = [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--no-pdf-header-footer',
          '--virtual-time-budget=8000',
          `--print-to-pdf=${outputPath}`,
          fileUrl
        ];

        execFile(browserPath, fallbackArgs, { timeout: 30000 }, (err2) => {
          if (err2) {
            return reject(new Error(`Failed to render PDF using browser: ${err2.message}`));
          }
          if (fs.existsSync(outputPath)) {
            resolve(outputPath);
          } else {
            reject(new Error('Browser finished but output PDF file was not created.'));
          }
        });
        return;
      }

      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error('Browser finished but output PDF file was not created.'));
      }
    });
  });
}

/**
 * Renders multiple HTML files to PDF using concurrent browser execution pool
 * @param {Array<{ htmlPath: string, outputPath: string }>} itemPairs 
 * @param {Object} options 
 * @returns {Promise<Array<string>>}
 */
async function renderBatchHtmlToPdf(itemPairs, options = {}) {
  const concurrency = Math.min(options.concurrency || 4, itemPairs.length);
  const results = [];
  const queue = [...itemPairs];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const pdfPath = await renderHtmlToPdf(item.htmlPath, item.outputPath, options);
      results.push(pdfPath);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = {
  findBrowserExecutable,
  renderHtmlToPdf,
  renderBatchHtmlToPdf
};

