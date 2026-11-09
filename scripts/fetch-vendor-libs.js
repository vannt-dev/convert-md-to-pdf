const fs = require('fs');
const path = require('path');

// The extension ships the browser builds of its libraries, copied from node_modules so the
// versions are the ones in package.json (devDependencies, pinned) and nothing is downloaded.
// Tests check that the copies match node_modules and that the CLI loads the same versions.
const root = path.join(__dirname, '..');
const libDir = path.join(root, 'extension', 'lib');
const fontDir = path.join(libDir, 'fonts');
const modules = path.join(root, 'node_modules');

// [source in node_modules, file name in extension/lib]
// marked 16 moved its browser build from marked.min.js to lib/marked.umd.js.
const FILES = [
  ['marked/lib/marked.umd.js', 'marked.min.js'],
  ['katex/dist/katex.min.js', 'katex.min.js'],
  ['katex/dist/katex.min.css', 'katex.min.css'],
  ['mermaid/dist/mermaid.min.js', 'mermaid.min.js'],
  ['@highlightjs/cdn-assets/highlight.min.js', 'highlight.min.js']
];

function version(name) {
  return JSON.parse(fs.readFileSync(path.join(modules, name, 'package.json'), 'utf8')).version;
}

const missing = FILES.map(([src]) => src).filter((src) => !fs.existsSync(path.join(modules, src)));
if (missing.length) {
  console.error(`✖ Not found in node_modules: ${missing.join(', ')}. Run npm install first.`);
  process.exit(1);
}

fs.mkdirSync(libDir, { recursive: true });
for (const [src, dest] of FILES) {
  fs.copyFileSync(path.join(modules, src), path.join(libDir, dest));
  const name = src.startsWith('@') ? src.split('/').slice(0, 2).join('/') : src.split('/')[0];
  console.log(`✔ ${dest} (${name} v${version(name)})`);
}

// KaTeX's CSS loads its fonts from fonts/ next to it. Chrome takes the first format it
// supports, so the woff2 files are enough.
fs.rmSync(fontDir, { recursive: true, force: true });
fs.mkdirSync(fontDir);
const fonts = fs.readdirSync(path.join(modules, 'katex/dist/fonts')).filter((f) => f.endsWith('.woff2'));
for (const font of fonts) {
  fs.copyFileSync(path.join(modules, 'katex/dist/fonts', font), path.join(fontDir, font));
}
console.log(`✔ fonts/ (${fonts.length} KaTeX woff2 fonts)`);

for (const shared of ['footnotes.js', 'pagemarks.js', 'math.js']) {
  fs.copyFileSync(path.join(root, 'src/core', shared), path.join(libDir, shared));
}
console.log('✔ footnotes.js, pagemarks.js, math.js (from src/core)');
