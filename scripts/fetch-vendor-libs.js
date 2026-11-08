const fs = require('fs');
const path = require('path');
const https = require('https');

const libDir = path.join(__dirname, '..', 'extension', 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// The extension ships the browser build of the marked the CLI uses, copied from node_modules
// (marked 16 moved it from marked.min.js to lib/marked.umd.js). A test checks the two match.
const markedSrc = path.join(__dirname, '..', 'node_modules', 'marked', 'lib', 'marked.umd.js');
const markedDest = path.join(libDir, 'marked.min.js');
if (!fs.existsSync(markedSrc)) {
  console.error(`✖ ${path.relative(process.cwd(), markedSrc)} not found: run npm install first`);
  process.exit(1);
}
fs.copyFileSync(markedSrc, markedDest);
console.log(`✔ Synced marked.min.js (marked v${require('marked/package.json').version})`);

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`✔ Downloaded ${path.basename(destPath)}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function fetchAll() {
  try {
    await downloadFile('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js', path.join(libDir, 'mermaid.min.js'));
    await downloadFile('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js', path.join(libDir, 'katex.min.js'));
    await downloadFile('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css', path.join(libDir, 'katex.min.css'));
    await downloadFile('https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/highlight.min.js', path.join(libDir, 'highlight.min.js'));
    console.log('✨ All vendor libraries successfully updated!');
  } catch (err) {
    console.error('✖ Error downloading vendor libraries:', err.message);
  }
}

fetchAll();
