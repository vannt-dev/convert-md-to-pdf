const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { 
  parseFrontMatter, 
  generateCoverPage,
  preprocessMarkdown, 
  generateToc, 
  sanitizeHtml, 
  escapeHtml 
} = require('../src/core/utils');
const { parseMarkdownToHtml } = require('../src/core/parser');
const { applyFootnotes } = require('../src/core/footnotes');
const { pageMarksCss, pageMarkBoxes } = require('../src/core/pagemarks');
const { convertMarkdownToPdf } = require('../src/core/index');
const { expandIncludes } = require('../src/core/include');
const { buildDocument, plainText } = require('../src/core/docmodel');
const { createZip, createZipAsync, crc32 } = require('../src/core/zip');
const { markdownToDocx } = require('../src/core/docx');
const { markdownToEpub } = require('../src/core/epub');
const { fileUrlPath, readLocalImage } = require('../src/core/images');
const os = require('os');
const { pathToFileURL } = require('url');

async function runTests() {
  console.log('\x1b[36m🧪 Running convert-md-to-pdf test suite...\x1b[0m\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(` \x1b[32m✔ PASS:\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(` \x1b[31m✖ FAIL:\x1b[0m ${name}`);
      console.error(`   ${err.stack}\n`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(` \x1b[32m✔ PASS:\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(` \x1b[31m✖ FAIL:\x1b[0m ${name}`);
      console.error(`   ${err.stack}\n`);
    }
  }

  // 1. YAML Front Matter Parser
  test('utils.parseFrontMatter: extracts metadata and content', () => {
    const raw = `---\ntitle: "Test Title"\ntheme: cyberpunk\ntoc: true\ncover: true\nfont: Lora\nmargin: 10mm\n---\n# Main Header\nContent line`;
    const { data, content } = parseFrontMatter(raw);
    assert.strictEqual(data.title, 'Test Title');
    assert.strictEqual(data.theme, 'cyberpunk');
    assert.strictEqual(data.toc, true);
    assert.strictEqual(data.cover, true);
    assert.strictEqual(data.font, 'Lora');
    assert.strictEqual(content.trim(), '# Main Header\nContent line');
  });

  // 2. Preprocess Pagebreak, GitHub Alerts & LaTeX
  test('utils.preprocessMarkdown: transforms pagebreaks, GitHub alerts & math symbols', () => {
    const raw = `Section 1\n> [!NOTE]\n> Alert text\n<!-- pagebreak -->\nSection 2`;
    const processed = preprocessMarkdown(raw);
    assert.ok(processed.includes('<div class="page-break"></div>'));
    assert.ok(processed.includes('ℹ️ NOTE:'));
  });

  // 3. TOC Generator with Dotted Leader Lines
  test('utils.generateToc: generates TOC HTML list with dotted leader lines', () => {
    const md = `# Heading One\n## Heading Two\n### Heading Three`;
    const { tocHtml, headingsMap } = generateToc(md);
    assert.ok(tocHtml.includes('Table of Contents'));
    assert.ok(tocHtml.includes('class="toc-item-dots"'));
    assert.strictEqual(headingsMap.get('Heading One'), 'heading-one');
  });

  // 4. Cover Page Generator
  test('utils.generateCoverPage: builds cover page HTML block', () => {
    const coverHtml = generateCoverPage({
      title: 'Project Proposal',
      subtitle: 'Version 2.0',
      author: 'vannt-dev',
      date: '2026-08-11',
      cover: true
    });
    assert.ok(coverHtml.includes('class="cover-page"'));
    assert.ok(coverHtml.includes('Project Proposal'));
    assert.ok(coverHtml.includes('Version 2.0'));
    assert.ok(coverHtml.includes('vannt-dev'));
    // .cover-page ends its own page; a second break would leave an empty page behind the cover
    assert.ok(!coverHtml.includes('page-break'));
  });

  test('cover: labels are English unless the document language has its own', () => {
    const meta = { title: 'T', author: 'Ann', date: '2026-10-20', cover: true };
    const english = generateCoverPage(meta);
    assert.ok(english.includes('<span class="cover-meta-label">Author:</span>'));
    assert.ok(english.includes('<span class="cover-meta-label">Date:</span>'));
    assert.ok(generateCoverPage({ ...meta, language: 'vi-VN' }).includes('Tác giả:'));
    assert.ok(generateCoverPage({ ...meta, language: 'fr' }).includes('Author:'));
    const html = parseMarkdownToHtml('---\nauthor: Ann\nlang: vi\n---\n# Doc');
    assert.ok(html.includes('<html lang="vi">'));
    assert.ok(html.includes('Tác giả:'));
    const plain = parseMarkdownToHtml('---\nauthor: Ann\n---\n# Doc');
    assert.ok(plain.includes('<html lang="en">'));
    assert.ok(plain.includes('Author:') && !plain.includes('Tác giả'));
  });

  // 5. HTML Sanitizer
  test('utils.sanitizeHtml: strips malicious script tags and onerror events', () => {
    const dirty = `<div>Safe Content</div><script>alert('xss')</script><img src="x" onerror="alert(1)" />`;
    const clean = sanitizeHtml(dirty);
    assert.ok(!clean.includes('<script>'));
    assert.ok(!clean.includes('onerror='));
    assert.ok(clean.includes('Safe Content'));
  });

  test('utils.sanitizeHtml: strips handlers however they are written, and only inside tags', () => {
    assert.strictEqual(sanitizeHtml('<img src="x"onerror=alert(1)>'), '<img src="x">');
    assert.strictEqual(sanitizeHtml('<svg/onload=alert(1)>'), '<svg>');
    assert.strictEqual(sanitizeHtml('<a ONCLICK=\'x()\' href="?online=1&y=onload=2">go</a>'), '<a href="?online=1&y=onload=2">go</a>');
    assert.ok(!sanitizeHtml('<img onerror="alert(1)>').includes('onerror'));
    assert.strictEqual(sanitizeHtml('<br />text onclick = fn'), '<br />text onclick = fn');
  });

  test('parser.parseMarkdownToHtml: keeps event handler assignments written in code', () => {
    const html = parseMarkdownToHtml('```\nel.onclick = () => greet();\n```\n\nInline `a.onload = b` too.');
    assert.ok(html.includes('el.onclick = () =&gt; greet();'));
    assert.ok(html.includes('<code>a.onload = b</code>'));
  });

  // 6. HTML Parser Integration (Themes, Font & Cover)
  test('parser.parseMarkdownToHtml: integrates cover page, new themes & font options', () => {
    const md = `---\ntitle: Cover Title\nsubtitle: Subtitle Text\ncover: true\ntheme: ebook\nfont: Lora\ntoc: true\n---\n# Chapter 1\nSome paragraph text.`;
    const html = parseMarkdownToHtml(md);
    assert.ok(html.includes('<title>Cover Title</title>'));
    assert.ok(html.includes('class="cover-page"'));
    assert.ok(html.includes('Subtitle Text'));
    assert.ok(html.includes('font-family: \'Lora\''));
  });

  // 6b. Markdown rendering through the custom renderer
  test('parser.parseMarkdownToHtml: renders headings with TOC ids and custom code blocks', () => {
    const md = '# Chapter 1\n\n## Sec **bold**\n\n```mermaid\ngraph TD\n```\n\n```js\nx<1\n```';
    const html = parseMarkdownToHtml(md, { toc: true });
    assert.ok(html.includes('<h1 id="chapter-1">Chapter 1</h1>'));
    assert.ok(html.includes('<h2 id="sec-bold">Sec <strong>bold</strong></h2>'));
    assert.ok(html.includes('<pre class="mermaid">graph TD</pre>'));
    assert.ok(html.includes('<code class="hljs language-js">x&lt;<span class="hljs-number">1</span>'));
  });

  // 6c. Syntax highlighting
  test('parser.parseMarkdownToHtml: highlights fenced code that names a known language', () => {
    const md = '```js\nconst a = "<b>";\n```\n\n```\nconst plain = 1;\n```\n\n```nosuchlang\nconst other = 1;\n```';
    const html = parseMarkdownToHtml(md);
    assert.ok(html.includes('<span class="hljs-keyword">const</span>'));
    assert.ok(html.includes('<span class="hljs-string">&quot;&lt;b&gt;&quot;</span>'));
    assert.ok(html.includes('<pre><code>const plain = 1;'));
    assert.ok(html.includes('<code class="language-nosuchlang">const other = 1;'));
  });

  test('parser.parseMarkdownToHtml: highlight can be turned off by option or front matter', () => {
    const md = '```js\nconst a = 1;\n```';
    assert.ok(!parseMarkdownToHtml(md, { highlight: false }).includes('<span class="hljs-keyword">'));
    assert.ok(!parseMarkdownToHtml('---\nhighlight: false\n---\n' + md).includes('<span class="hljs-keyword">'));
    assert.ok(parseMarkdownToHtml(md).includes('<span class="hljs-keyword">'));
  });

  test('themes.getThemeStyles: token colours follow the code block background', () => {
    const { getThemeStyles } = require('../src/core/themes');
    assert.ok(getThemeStyles('modern').includes('.hljs-doctag, .hljs-template-tag { color: #ff7b72; }'));
    assert.ok(getThemeStyles('github').includes('.hljs-doctag, .hljs-template-tag { color: #cf222e; }'));
    assert.ok(getThemeStyles('nosuchtheme').includes('color: #ff7b72;'));
  });

  // 7. Converter HTML Export
  await asyncTest('core.convertMarkdownToPdf: exports HTML file directly with format option', async () => {
    const samplePath = path.join(__dirname, '../examples/sample.md');
    const outHtmlPath = path.join(__dirname, 'test_output.html');
    
    if (fs.existsSync(outHtmlPath)) fs.unlinkSync(outHtmlPath);

    const result = await convertMarkdownToPdf(samplePath, outHtmlPath, { format: 'html', toc: true, theme: 'github' });
    assert.strictEqual(result.htmlPath, outHtmlPath);
    assert.ok(fs.existsSync(outHtmlPath));

    const content = fs.readFileSync(outHtmlPath, 'utf8');
    assert.ok(content.includes('<!DOCTYPE html>'));

    // Clean up
    if (fs.existsSync(outHtmlPath)) fs.unlinkSync(outHtmlPath);
  });

  test('core.temporaryHtmlPath: the page to print is written beside the source, not beside the PDF', () => {
    const { temporaryHtmlPath } = require('../src/core/index');
    const source = path.join(__dirname, '../examples/sample.md');
    const elsewhere = path.join(require('os').tmpdir(), 'out', 'sample.pdf');
    const temp = temporaryHtmlPath(source, elsewhere);
    // relative pictures of the Markdown file resolve from its own folder
    assert.strictEqual(path.dirname(temp), path.dirname(source));
    assert.ok(/^_temp_.+\.html$/.test(path.basename(temp)));
    // a source folder that cannot be written to falls back to the PDF's folder
    const missing = path.join(__dirname, 'no-such-folder', 'doc.md');
    assert.strictEqual(path.dirname(temporaryHtmlPath(missing, elsewhere)), path.dirname(elsewhere));
  });

  // 7b. PDF bookmarks
  test('renderer.buildBrowserArgs: bookmarks from headings unless turned off, also for old browsers', () => {
    const { buildBrowserArgs } = require('../src/browser/renderer');
    const args = buildBrowserArgs('file:///C:/doc.html', 'C:/doc.pdf');
    assert.deepStrictEqual(args, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      '--generate-pdf-document-outline',
      '--virtual-time-budget=8000',
      '--print-to-pdf=C:/doc.pdf',
      'file:///C:/doc.html'
    ]);
    const legacy = buildBrowserArgs('file:///C:/doc.html', 'C:/doc.pdf', { legacyHeadless: true });
    assert.strictEqual(legacy[0], '--headless');
    assert.ok(legacy.includes('--generate-pdf-document-outline'));
    assert.ok(!buildBrowserArgs('u', 'o', { outline: false }).includes('--generate-pdf-document-outline'));
  });

  test('core.pdfOutline: on by default, off by front matter, an option wins', () => {
    const { pdfOutline } = require('../src/core/index');
    assert.strictEqual(pdfOutline('# Doc'), true);
    const off = '---\noutline: false\n---\n# Doc';
    assert.strictEqual(pdfOutline(off), false);
    assert.strictEqual(pdfOutline(off, { outline: true }), true);
    assert.strictEqual(pdfOutline('# Doc', { outline: false }), false);
  });

  // 7c. Command line: flags whose value could swallow the input file
  test('cli: --header needs its text; an input file right after it is refused clearly', () => {
    const { spawnSync } = require('child_process');
    const root = path.join(__dirname, '..');
    const cli = (...args) => spawnSync(process.execPath, ['bin/cli.js', ...args], { cwd: root, encoding: 'utf8' });

    for (const flag of ['--header', '--footer']) {
      const swallowed = cli(flag, 'examples/sample.md');
      assert.notStrictEqual(swallowed.status, 0);
      assert.ok(swallowed.stderr.includes('"examples/sample.md" is an input file, not header/footer text'));
    }
    const missing = cli('examples/sample.md', '--header');
    assert.notStrictEqual(missing.status, 0);
    assert.ok(missing.stderr.includes("option '--header <text>' argument missing"));

    const out = path.join(os.tmpdir(), `md-pdf-cli-${process.pid}.html`);
    const works = cli('--header', '{title}', '--footer', '', 'examples/sample.md', '-f', 'html', '-o', out);
    assert.strictEqual(works.status, 0, works.stderr);
    const html = fs.readFileSync(out, 'utf8');
    assert.ok(html.includes('@top-center { content: "Sample Document: Markdown to PDF Conversion";'));
    assert.ok(!html.includes('@bottom-'));
    fs.unlinkSync(out);
  });

  test('cli: --page-numbers reads only full or simple as its value, so an input after it stays an input', () => {
    const { normalizePageNumbersArgs } = require('../src/cli/options');
    const argv = ['node', 'cli.js'];
    assert.deepStrictEqual(normalizePageNumbersArgs([...argv, '--page-numbers', 'README.md']), [...argv, '--page-numbers=full', 'README.md']);
    assert.deepStrictEqual(normalizePageNumbersArgs([...argv, '--page-numbers', 'Simple', 'a.md']), [...argv, '--page-numbers=simple', 'a.md']);
    assert.deepStrictEqual(normalizePageNumbersArgs([...argv, 'a.md', '--page-numbers']), [...argv, 'a.md', '--page-numbers=full']);
    assert.deepStrictEqual(normalizePageNumbersArgs([...argv, '--page-numbers=simple', 'a.md']), [...argv, '--page-numbers=simple', 'a.md']);
    assert.deepStrictEqual(normalizePageNumbersArgs([...argv, '--', '--page-numbers', 'x']), [...argv, '--', '--page-numbers', 'x']);

    const { spawnSync } = require('child_process');
    const out = path.join(os.tmpdir(), `md-pdf-pages-${process.pid}.html`);
    const run = spawnSync(process.execPath, ['bin/cli.js', '--page-numbers', 'examples/sample.md', '-f', 'html', '-o', out], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    assert.strictEqual(run.status, 0, run.stderr);
    assert.ok(fs.readFileSync(out, 'utf8').includes('@bottom-center { content: "Page " counter(page) " of " counter(pages);'));
    fs.unlinkSync(out);
  });

  // 7d. Project config file (.mdpdfrc) and Markdown from stdin
  test('config: .mdpdfrc is found in the folder or a parent, up to the folder that holds .git', () => {
    const { findConfigFile } = require('../src/cli/config');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-rc-find-'));
    const sub = path.join(repo, 'docs', 'guide');
    fs.mkdirSync(sub, { recursive: true });
    fs.mkdirSync(path.join(repo, '.git'));
    assert.strictEqual(findConfigFile(sub), null);

    fs.writeFileSync(path.join(repo, '.mdpdfrc.json'), '{}');
    assert.strictEqual(findConfigFile(sub), path.join(repo, '.mdpdfrc.json'));
    fs.writeFileSync(path.join(repo, '.mdpdfrc'), '{}');
    assert.strictEqual(findConfigFile(sub), path.join(repo, '.mdpdfrc'), '.mdpdfrc comes before .mdpdfrc.json');
    fs.writeFileSync(path.join(sub, '.mdpdfrc.json'), '{}');
    assert.strictEqual(findConfigFile(sub), path.join(sub, '.mdpdfrc.json'), 'the nearest file wins');

    // The search stops at the repository root: a file above it is not used.
    fs.rmSync(path.join(sub, '.mdpdfrc.json'));
    fs.mkdirSync(path.join(repo, 'docs', '.git'));
    assert.strictEqual(findConfigFile(sub), null);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test('config: loadConfig reads JSON, warns about unknown keys and resolves paths from its folder', () => {
    const { loadConfig } = require('../src/cli/config');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-rc-load-'));
    const file = path.join(dir, '.mdpdfrc');
    fs.writeFileSync(file, JSON.stringify({ theme: 'dark', toc: true, pageNumbers: 'simple', css: 'style/a.css', output: 'dist', colour: 'red' }));
    const { config, warnings } = loadConfig(file);
    assert.deepStrictEqual(config, {
      theme: 'dark',
      toc: true,
      pageNumbers: 'simple',
      css: path.join(dir, 'style', 'a.css'),
      output: path.join(dir, 'dist')
    });
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('unknown key "colour"'));

    fs.writeFileSync(file, '{ "theme": "dark", }');
    assert.throws(() => loadConfig(file), (err) => err.message.includes(file) && err.message.includes('not valid JSON'));
    fs.writeFileSync(file, '["dark"]');
    assert.throws(() => loadConfig(file), /must hold a JSON object/);
    fs.writeFileSync(file, '{ "toc": "yes" }');
    assert.throws(() => loadConfig(file), /"toc" must be true or false/);
    fs.writeFileSync(file, '{ "pageNumbers": "roman" }');
    assert.throws(() => loadConfig(file), /"pageNumbers" must be/);
    assert.throws(() => loadConfig(path.join(dir, 'missing.json')), /Config file not found/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('config: flags beat front matter, front matter beats .mdpdfrc', () => {
    const { layerOptions } = require('../src/cli/config');
    const rc = { theme: 'dark', watermark: 'RC', landscape: true, css: '/rc.css', format: 'html', toc: true };
    // Nothing on the command line or in the front matter: the config file decides.
    assert.deepStrictEqual(layerOptions({}, rc, {}), rc);
    // The front matter sets the key: it is left to the front matter.
    const fromFrontMatter = layerOptions({}, rc, { theme: 'academic', orientation: 'portrait', css: 'fm.css', toc: false });
    assert.strictEqual(fromFrontMatter.theme, undefined);
    assert.strictEqual(fromFrontMatter.landscape, undefined);
    assert.strictEqual(fromFrontMatter.css, undefined);
    assert.strictEqual(fromFrontMatter.toc, undefined);
    assert.strictEqual(fromFrontMatter.watermark, 'RC');
    // format is not a front matter key, so the config file still sets it.
    assert.strictEqual(fromFrontMatter.format, 'html');
    // A flag wins over both.
    const flagged = layerOptions({ theme: 'github', watermark: '' }, rc, { theme: 'academic' });
    assert.strictEqual(flagged.theme, 'github');
    assert.strictEqual(flagged.watermark, '');
  });

  test('cli: .mdpdfrc sets defaults; flags and front matter override it; bad JSON exits 1', () => {
    const { spawnSync } = require('child_process');
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-rc-cli-'));
    fs.mkdirSync(path.join(dir, '.git'));
    const cli = (...args) => spawnSync(process.execPath, [cliPath, ...args], { cwd: dir, encoding: 'utf8' });
    const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
    const DARK = 'color: #e2e8f0; background-color: #0f172a';
    fs.writeFileSync(path.join(dir, 'plain.md'), '# Plain\n\n## Part\n');
    fs.writeFileSync(path.join(dir, 'fm.md'), '---\ntheme: academic\nwatermark: FROM-FM\ntoc: false\n---\n# FM\n\n## Part\n');
    fs.writeFileSync(
      path.join(dir, '.mdpdfrc'),
      JSON.stringify({ format: 'html', theme: 'dark', watermark: 'FROM-RC', toc: true, output: 'out', shiny: 1 })
    );

    const run = cli('plain.md');
    assert.strictEqual(run.status, 0, run.stderr);
    assert.ok(run.stderr.includes('unknown key "shiny"'));
    let html = read('out/plain.html');
    assert.ok(html.includes(DARK));
    assert.ok(html.includes('FROM-RC'));
    assert.ok(html.includes('class="toc'));

    assert.strictEqual(cli('plain.md', '--watermark', 'FROM-FLAG', '-t', 'github').status, 0);
    html = read('out/plain.html');
    assert.ok(html.includes('FROM-FLAG') && !html.includes('FROM-RC'));
    assert.ok(!html.includes(DARK));

    assert.strictEqual(cli('fm.md').status, 0);
    html = read('out/fm.html');
    assert.ok(html.includes('FROM-FM') && !html.includes('FROM-RC'));
    assert.ok(!html.includes(DARK));
    assert.ok(!html.includes('class="toc'));

    // --no-config: built-in defaults, with front matter still applied.
    assert.strictEqual(cli('plain.md', '--no-config', '-f', 'html', '-o', 'bare.html').status, 0);
    html = read('bare.html');
    assert.ok(!html.includes('FROM-RC') && !html.includes(DARK) && !html.includes('class="toc'));

    // --config names another file.
    fs.writeFileSync(path.join(dir, 'ci.json'), JSON.stringify({ format: 'html', watermark: 'FROM-CI' }));
    assert.strictEqual(cli('plain.md', '--config', 'ci.json', '-o', 'ci.html').status, 0);
    assert.ok(read('ci.html').includes('FROM-CI'));
    const missing = cli('plain.md', '--config', 'nope.json');
    assert.strictEqual(missing.status, 1);
    assert.ok(missing.stderr.includes('Config file not found'));

    fs.writeFileSync(path.join(dir, '.mdpdfrc'), '{ "theme": "dark" ');
    const broken = cli('plain.md');
    assert.strictEqual(broken.status, 1);
    assert.ok(broken.stderr.includes('.mdpdfrc') && broken.stderr.includes('not valid JSON'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('cli: front matter theme and toc apply when no flag is given', () => {
    const { spawnSync } = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-fm-cli-'));
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, 'a.md'), '---\ntheme: dark\ntoc: true\n---\n# A\n\n## Part\n');
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const run = spawnSync(process.execPath, [cliPath, 'a.md', '-f', 'html'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(run.status, 0, run.stderr);
    const html = fs.readFileSync(path.join(dir, 'a.html'), 'utf8');
    assert.ok(html.includes('color: #e2e8f0; background-color: #0f172a'));
    assert.ok(html.includes('class="toc'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('cli: "-" reads Markdown from stdin, needs -o, and finds pictures from the current folder', () => {
    const { spawnSync } = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-stdin-'));
    fs.mkdirSync(path.join(dir, '.git'));
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(2, 16);
    png.writeUInt32BE(3, 20);
    fs.writeFileSync(path.join(dir, 'pic.png'), png);
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const cli = (input, ...args) => spawnSync(process.execPath, [cliPath, ...args], { cwd: dir, input, encoding: 'utf8' });

    const html = cli('# From stdin\n\nPiped text.\n', '-', '-f', 'html', '-o', 'piped.html');
    assert.strictEqual(html.status, 0, html.stderr);
    assert.ok(fs.readFileSync(path.join(dir, 'piped.html'), 'utf8').includes('From stdin'));

    const docx = cli('# Pic\n\n![p](pic.png)\n', '-', '-f', 'docx', '-o', 'piped.docx');
    assert.strictEqual(docx.status, 0, docx.stderr);
    assert.ok(fs.readFileSync(path.join(dir, 'piped.docx')).includes(png));

    const noOut = cli('# x\n', '-', '-f', 'html');
    assert.strictEqual(noOut.status, 1);
    assert.ok(noOut.stderr.includes('needs -o'));
    const mixed = cli('# x\n', '-', 'other.md', '-f', 'html', '-o', 'x.html');
    assert.strictEqual(mixed.status, 1);
    assert.ok(mixed.stderr.includes('only input'));
    // No temporary files are left in the folder.
    assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => /^_temp_|stdin/.test(f)), []);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // 8. Extension package
  test('extension: every page and script the manifest and pages refer to is tracked by git', () => {
    const { execFileSync } = require('child_process');
    const root = path.join(__dirname, '..');
    const tracked = new Set(
      execFileSync('git', ['ls-files', 'extension'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
    );
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
    const pages = [manifest.action.default_popup, 'preview/preview.html'];
    const needed = [manifest.background.service_worker, ...pages];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(root, 'extension', page), 'utf8');
      for (const [, ref] of html.matchAll(/(?:src|href)="([^":]+)"/g)) {
        needed.push(path.posix.join(path.posix.dirname(page), ref));
      }
    }
    const missing = needed.filter((file) => !tracked.has(`extension/${file}`));
    assert.deepStrictEqual(missing, []);
  });

  // 8b. Page numbers and running header/footer
  test('pagemarks: nothing is printed in the margins unless asked for', () => {
    assert.strictEqual(pageMarksCss({}), '');
    assert.strictEqual(pageMarksCss({ header: false, footer: '', pageNumbers: false }), '');
    const html = parseMarkdownToHtml('---\ncover: true\n---\n# Plain\n\nText.');
    assert.ok(!/@(top|bottom)-/.test(html));
    assert.ok(!html.includes('page: cover'));
  });

  test('pagemarks: page numbers come in a full and a simple style; others are refused', () => {
    assert.deepStrictEqual(pageMarkBoxes({ pageNumbers: true }), { 'bottom-center': 'Page {page} of {pages}' });
    assert.deepStrictEqual(pageMarkBoxes({ pageNumbers: 'Simple' }), { 'bottom-center': '{page}' });
    assert.ok(pageMarksCss({ pageNumbers: 'full' }).includes('@bottom-center { content: "Page " counter(page) " of " counter(pages);'));
    assert.ok(pageMarksCss({ pageNumbers: 'simple' }).includes('@bottom-center { content: counter(page);'));
    assert.throws(() => pageMarksCss({ pageNumbers: 'roman' }), /Unknown page number style "roman"/);
  });

  test('pagemarks: header and footer fill in placeholders and stay inside their CSS string', () => {
    assert.deepStrictEqual(pageMarkBoxes({ header: true, footer: 'Draft', pageNumbers: true }), {
      'top-center': '{title}',
      'bottom-left': 'Draft',
      'bottom-right': 'Page {page} of {pages}'
    });
    assert.deepStrictEqual(pageMarkBoxes({ footer: true }), { 'bottom-center': 'Page {page} of {pages}' });
    const css = pageMarksCss(
      { header: '{title} by {author}', footer: '{date} | {page}/{pages} {unknown}' },
      { title: 'Say "hi" \\ </style><script>', author: 'Ann', date: '2026-10-20' }
    );
    assert.ok(css.includes('@top-center { content: "Say \\"hi\\" \\\\ \\3C /style>\\3C script> by Ann";'));
    assert.ok(css.includes('@bottom-center { content: "2026-10-20 | " counter(page) "/" counter(pages) " {unknown}";'));
    assert.ok(!css.includes('</style>'));
    // The cover page is printed without them.
    assert.ok(css.includes('.cover-page { page: cover; }'));
    assert.ok(css.includes('@page cover {\n  @top-center { content: none; }\n  @bottom-center { content: none; }\n}'));
  });

  test('parser.parseMarkdownToHtml: header, footer and page numbers come from front matter, options win', () => {
    const md = '---\ntitle: Field Guide\nheader: true\npageNumbers: simple\n---\n# Field Guide\n\nText.';
    const html = parseMarkdownToHtml(md);
    assert.ok(html.includes('@top-center { content: "Field Guide";'));
    assert.ok(html.includes('@bottom-center { content: counter(page);'));
    assert.ok(html.includes('font-family: "Inter", sans-serif'));
    const overridden = parseMarkdownToHtml(md, { header: 'Internal', pageNumbers: false });
    assert.ok(overridden.includes('@top-center { content: "Internal";'));
    assert.ok(!overridden.includes('@bottom-'));
    // Custom CSS comes after, so it can restyle the margins.
    const custom = parseMarkdownToHtml(md, { customCss: '@page { @top-center { color: red; } }' });
    assert.ok(custom.indexOf('content: "Field Guide"') < custom.indexOf('color: red'));
  });

  test('pagemarks: a watermark is faint diagonal text on every page, kept inside its CSS string', () => {
    assert.strictEqual(pageMarksCss({ watermark: '' }), '');
    assert.strictEqual(pageMarksCss({ watermark: '   ' }), '');
    const css = pageMarksCss({ watermark: 'DRAFT', font: 'Inter' });
    assert.ok(css.startsWith('/* Watermark */\nbody::after { content: "DRAFT"; position: fixed;'));
    assert.ok(css.includes('rotate(-35deg)'));
    assert.ok(css.includes('font-family: "Inter", sans-serif; font-size: 96px;'));
    assert.ok(!css.includes('@page'));
    // long text gets smaller, down to a floor
    assert.ok(pageMarksCss({ watermark: 'CONFIDENTIAL - DO NOT SHARE' }).includes('font-size: 40px;'));
    assert.ok(pageMarksCss({ watermark: 'x'.repeat(200) }).includes('font-size: 28px;'));
    const tricky = pageMarksCss({ watermark: 'Say "hi" </style>' });
    assert.ok(tricky.includes('content: "Say \\"hi\\" \\3C /style>";'));
    assert.ok(!tricky.includes('</style>'));
    // with margin texts, it comes after them
    const both = pageMarksCss({ pageNumbers: true, watermark: 'DRAFT' });
    assert.ok(both.indexOf('@bottom-center') < both.indexOf('/* Watermark */'));
  });

  test('parser.parseMarkdownToHtml: the watermark comes from front matter, options win', () => {
    const md = '---\nwatermark: Internal\n---\n# Memo\n\nText.';
    assert.ok(parseMarkdownToHtml(md).includes('body::after { content: "Internal";'));
    assert.ok(parseMarkdownToHtml(md, { watermark: 'DRAFT' }).includes('body::after { content: "DRAFT";'));
    assert.ok(!parseMarkdownToHtml(md, { watermark: '' }).includes('body::after'));
    assert.ok(!parseMarkdownToHtml('# Plain\n\nText.').includes('body::after'));
  });

  test('extension: ships the browser build of the marked version the CLI uses', () => {
    const root = path.join(__dirname, '..');
    const installed = require('marked/package.json').version;
    const shipped = fs.readFileSync(path.join(root, 'extension/lib/marked.min.js'), 'utf8');
    const shippedVersion = (shipped.match(/marked v(\d+\.\d+\.\d+)/) || [])[1];
    assert.strictEqual(shippedVersion, installed, 'run `npm run fetch:libs` after updating marked');
    assert.ok(
      shipped === fs.readFileSync(path.join(root, 'node_modules/marked/lib/marked.umd.js'), 'utf8'),
      'extension/lib/marked.min.js must be a copy of node_modules/marked/lib/marked.umd.js'
    );
  });

  test('extension: ships KaTeX (with its fonts), Mermaid and highlight.js copied from node_modules', () => {
    const root = path.join(__dirname, '..');
    const same = (shipped, source) => assert.ok(
      fs.readFileSync(path.join(root, 'extension/lib', shipped)).equals(fs.readFileSync(path.join(root, 'node_modules', source))),
      `extension/lib/${shipped} must be a copy of node_modules/${source}: run \`npm run fetch:libs\``
    );
    same('katex.min.js', 'katex/dist/katex.min.js');
    same('katex.min.css', 'katex/dist/katex.min.css');
    same('mermaid.min.js', 'mermaid/dist/mermaid.min.js');
    same('highlight.min.js', '@highlightjs/cdn-assets/highlight.min.js');
    const fonts = fs.readdirSync(path.join(root, 'node_modules/katex/dist/fonts')).filter((f) => f.endsWith('.woff2'));
    assert.ok(fonts.length > 0);
    fonts.forEach((font) => same(`fonts/${font}`, `katex/dist/fonts/${font}`));
    // The CSS names every font it may load; each one is shipped.
    const css = fs.readFileSync(path.join(root, 'extension/lib/katex.min.css'), 'utf8');
    for (const [, font] of css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)) assert.ok(fonts.includes(font), font);
  });

  test('cli: loads the KaTeX and Mermaid versions the extension ships', () => {
    const { KATEX_VERSION, MERMAID_VERSION, getHtmlTemplate } = require('../src/core/templates');
    const dev = require('../package.json').devDependencies;
    assert.strictEqual(KATEX_VERSION, dev.katex);
    assert.strictEqual(MERMAID_VERSION, dev.mermaid);
    assert.strictEqual(require('@highlightjs/cdn-assets/package.json').version, require('highlight.js/package.json').version);
    const html = getHtmlTemplate({ title: 'T', bodyHtml: '<p>x</p>' });
    assert.ok(html.includes(`katex@${KATEX_VERSION}/dist/katex.min.js`));
    assert.ok(html.includes(`mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`));
    assert.ok(html.includes('MdPdfMath.renderMath(document.body, katex)'));
    assert.ok(html.includes("look: 'classic'"));
    const off = getHtmlTemplate({ title: 'T', bodyHtml: '', options: { katex: false, mermaid: false } });
    assert.ok(!off.includes('katex') && !off.includes('mermaid@'));
  });

  test('math: $...$ is math, prices and spaced dollars stay text', () => {
    const { splitMath } = require('../src/core/math');
    assert.deepStrictEqual(splitMath('Energy $E = mc^2$ here'), [
      { text: 'Energy ' }, { tex: 'E = mc^2', display: false }, { text: ' here' }
    ]);
    assert.deepStrictEqual(splitMath('$$ x^2 $$ after'), [{ tex: 'x^2', display: true }, { text: ' after' }]);
    for (const plain of ['costs $5 and $10 today', 'a $ b $ c', 'only $5$ here', '$a$5', 'one $ alone', 'no math']) {
      assert.deepStrictEqual(splitMath(plain), [{ text: plain }], plain);
    }
    assert.deepStrictEqual(splitMath('\\$x$ then $y$'), [{ text: '\\$x$ then ' }, { tex: 'y', display: false }]);
    // The extension ships the same file.
    const root = path.join(__dirname, '..');
    assert.strictEqual(
      fs.readFileSync(path.join(root, 'extension/lib/math.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'src/core/math.js'), 'utf8')
    );
    const page = fs.readFileSync(path.join(root, 'extension/preview/preview.html'), 'utf8');
    assert.ok(page.includes('<script src="../lib/math.js"></script>'));
  });

  // What KaTeX is handed for each formula in the page, in order.
  const texIn = (html) => {
    const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const found = [];
    const re = /<span class="math-inline">([\s\S]*?)<\/span>|<div class="formula-box">([\s\S]*?)<\/div>/g;
    for (let m = re.exec(html); m; m = re.exec(html)) found.push(unescape(m[1] !== undefined ? m[1] : m[2]));
    return found;
  };
  const bodyOf = (md, options) => {
    const html = parseMarkdownToHtml(md, options);
    return html.slice(html.indexOf('<body'));
  };

  test('math: Markdown leaves the TeX inside $...$ alone', () => {
    const cases = [
      String.raw`\{x \mid x > 0\}`,
      String.raw`a\,b`,
      String.raw`a_1 * b_2 * c`,
      String.raw`a*b*c`,
      String.raw`x_i + y_j`,
      String.raw`a<b`,
      String.raw`\alpha \rightarrow \beta \longrightarrow \gamma`,
      String.raw`a \& b \% c \# d`,
      String.raw`[x](y)`
    ];
    for (const tex of cases) {
      assert.deepStrictEqual(texIn(bodyOf(`Before $${tex}$ after.`)), [tex], tex);
    }
    // Two formulas with underscores on one line used to become emphasis.
    const two = bodyOf(String.raw`So $a_1 + b_1$ and _then_ $c_2*d_2$ and *more*.`);
    assert.deepStrictEqual(texIn(two), ['a_1 + b_1', 'c_2*d_2']);
    assert.ok(two.includes('<em>then</em>') && two.includes('<em>more</em>'));
  });

  test('math: $$...$$ keeps line breaks, braces and comparisons', () => {
    const tex = String.raw`\begin{aligned}
a_1 &= b_1 + c_1 \\
a_2 &= b_2 * c_2 * d \\

S &= \{x \mid x < 1\}
\end{aligned}`;
    const block = bodyOf(`Text\n\n$$\n${tex}\n$$\n\nMore`);
    assert.deepStrictEqual(texIn(block), [tex]);
    // A formula on lines of its own is not left inside a paragraph.
    assert.ok(!/<p>\s*<div class="formula-box">/.test(block));
    const inline = String.raw`a \\ b_1 * c_1 * d`;
    assert.deepStrictEqual(texIn(bodyOf(`Sum $$${inline}$$ in a sentence`)), [inline]);
    // The drawn "A = B - C" box is kept.
    const drawn = bodyOf(String.raw`$$ \text{Profit} = \text{Revenue} - \text{Cost} $$`);
    assert.ok(drawn.includes('<div class="formula-box"><strong>Profit</strong> = <span>Revenue</span>'));
  });

  test('math: prices and escaped dollars stay text', () => {
    const prices = bodyOf('This costs $5 and $10 today, or $ 3 $ there.');
    assert.deepStrictEqual(texIn(prices), []);
    assert.ok(prices.includes('This costs $5 and $10 today, or $ 3 $ there.'));
    const escaped = bodyOf(String.raw`Pay \$x\$ now and \$20 later, then $y_1$.`);
    assert.deepStrictEqual(texIn(escaped), ['y_1']);
    // Each escaped dollar is fenced off, so the page's math pass cannot pair two of them.
    assert.ok(escaped.includes('Pay <span class="math-dollar">$</span>x<span class="math-dollar">$</span> now'));
    assert.ok(!escaped.includes('\\$'));
    // A lone dollar does not reach into the next paragraph.
    assert.deepStrictEqual(texIn(bodyOf('Only $a here.\n\nAnd b$ there.')), []);
  });

  test('math: code is left as written', () => {
    const span = bodyOf('Code `$a_1 * b_2$` and ``$x$ ` $y$`` then $z_1$.');
    assert.deepStrictEqual(texIn(span), ['z_1']);
    assert.ok(span.includes('<code>$a_1 * b_2$</code>'));
    assert.ok(span.includes('<code>$x$ ` $y$</code>'));
    const fenced = bodyOf('```\nconst a = `$x_1$`; // $$y$$\n```\n\n~~~js\nlet b = "$p_1$";\n~~~\n\n- item\n\n  ```\n  $q_1$\n  ```\n');
    assert.deepStrictEqual(texIn(fenced), []);
    assert.ok(fenced.includes('const a = `$x_1$`; // $$y$$'));
    assert.ok(fenced.includes('$q_1$'));
    const indented = bodyOf('Text\n\n    indented $a_1 * b_2$ and $$c$$ code\n');
    assert.deepStrictEqual(texIn(indented), []);
    assert.ok(indented.includes('indented $a_1 * b_2$ and $$c$$ code'));
    // In an attribute the source text comes back, not markup.
    const alt = bodyOf('![area $x_1 < y$](a.png)');
    assert.ok(alt.includes('alt="area $x_1 &lt; y$"'), alt);
  });

  test('math: works in tables, lists, headings and the table of contents', () => {
    const table = bodyOf(String.raw`| Name | Formula |
|------|---------|
| Set  | $\{a_1, a_2\}$ |
| Abs  | $|x| * |y|$ |
`);
    assert.deepStrictEqual(texIn(table), [String.raw`\{a_1, a_2\}`, '|x| * |y|']);
    assert.strictEqual((table.match(/<td>/g) || []).length, 4);
    const list = bodyOf(String.raw`- First $x_1 * x_2 * x_3$
- Second $\frac{a_1}{b_1}\,dx$
`);
    assert.deepStrictEqual(texIn(list), ['x_1 * x_2 * x_3', String.raw`\frac{a_1}{b_1}\,dx`]);
    assert.strictEqual((list.match(/<li>/g) || []).length, 2);
    const toc = bodyOf(String.raw`# Title

## Energy $E_0 = m\,c^2$

Text`, { toc: true });
    assert.deepStrictEqual(texIn(toc), [String.raw`E_0 = m\,c^2`, String.raw`E_0 = m\,c^2`]);
    assert.ok(!/[]/.test(toc));
  });

  test('math: with --no-katex the document is handled as before', () => {
    const off = bodyOf(String.raw`Go $\ge$ and $a_1$.`, { katex: false });
    assert.ok(off.includes('Go ≥ and $a_1$.'));
    assert.ok(!off.includes('math-inline'));
  });

  test('math: protectMath round trip and the extension preview uses it', () => {
    const { protectMath } = require('../src/core/math');
    const none = protectMath('No math, costs $5.');
    assert.strictEqual(none.text, 'No math, costs $5.');
    assert.strictEqual(none.restore('<p>x</p>'), '<p>x</p>');
    const kept = protectMath(String.raw`A $a_1$ and $$b \\ c$$ end`);
    assert.ok(!kept.text.includes('a_1') && !kept.text.includes('\\'));
    assert.strictEqual(
      kept.restore(`<p>${kept.text}</p>`),
      String.raw`<p>A <span class="math-inline">a_1</span> and <div class="formula-box">b \\ c</div> end</p>`
    );
    assert.strictEqual(kept.restore(`<pre><code>${kept.text}</code></pre>`), String.raw`<pre><code>A $a_1$ and $$b \\ c$$ end</code></pre>`);
    // Replacement patterns in the TeX ("$&", "$'") are not expanded.
    const odd = protectMath("$a$' and $b$& c$");
    assert.deepStrictEqual(texIn(odd.restore(odd.text)), ['a', 'b']);
    const preview = fs.readFileSync(path.join(__dirname, '../extension/preview/preview.js'), 'utf8');
    assert.ok(preview.includes('MdPdfMath.protectMath(') && preview.includes('.restore('));
  });

  test('themes: a Mermaid diagram does not get the code block background', () => {
    const { THEMES } = require('../src/core/themes');
    const { getThemeStyles } = require('../src/core/themes');
    for (const theme of Object.keys(THEMES)) {
      assert.ok(getThemeStyles(theme).includes('pre.mermaid[data-processed] { background: transparent;'), theme);
    }
    const preview = fs.readFileSync(path.join(__dirname, '..', 'extension/preview/preview.js'), 'utf8');
    assert.ok(preview.includes('pre.mermaid[data-processed] { background: transparent;'));
  });

  test('extension: ships the same page number code as the CLI and prints no fixed footer', () => {
    const root = path.join(__dirname, '..');
    assert.strictEqual(
      fs.readFileSync(path.join(root, 'extension/lib/pagemarks.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'src/core/pagemarks.js'), 'utf8')
    );
    const preview = fs.readFileSync(path.join(root, 'extension/preview/preview.js'), 'utf8');
    assert.ok(preview.includes('MdPdfPageMarks.pageMarksCss('));
    const page = fs.readFileSync(path.join(root, 'extension/preview/preview.html'), 'utf8');
    assert.ok(page.includes('<script src="../lib/pagemarks.js"></script>'));
    assert.ok(!page.includes('Convert MD to PDF Extension'));
    assert.ok(!/[ạảãáàâấầẩẫậăắằẳẵặđẹẻẽéèêếềểễệịỉĩíìọỏõóòôốồổỗộơớờởỡợụủũúùưứừửữựỵỷỹýỳ]/i.test(page));
  });

  // 9. Footnotes
  test('footnotes: references are numbered in order of first use and linked to their notes', () => {
    const out = applyFootnotes(
      'Second[^b] comes first, then first[^a], then second again[^b].\n\n[^a]: Note A\n[^b]: Note **B**\n'
    );
    assert.ok(out.includes('Second<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup>'));
    assert.ok(out.includes('first<sup class="footnote-ref"><a href="#fn-2" id="fnref-2">2</a></sup>'));
    assert.ok(out.includes('again<sup class="footnote-ref"><a href="#fn-1" id="fnref-1-2">1</a></sup>'));
    assert.ok(out.indexOf('1. <span id="fn-1"></span>Note **B**') < out.indexOf('2. <span id="fn-2"></span>Note A'));
    assert.ok(!/^\[\^a\]:/m.test(out), 'definitions are taken out of the body');
  });

  test('footnotes: code, undefined references and unused notes are left alone', () => {
    const md = [
      'Real[^1], undefined[^nope], inline code `x[^1]`.',
      '',
      '```md',
      'Example[^1]',
      '[^1]: not a definition',
      '```',
      '',
      '[^1]: A note that',
      '    continues on the next line',
      '[^unused]: Never referenced',
    ].join('\n');
    const out = applyFootnotes(md);
    assert.ok(out.includes('undefined[^nope]'));
    assert.ok(out.includes('`x[^1]`'));
    assert.ok(out.includes('Example[^1]\n[^1]: not a definition'));
    assert.ok(out.includes('A note that continues on the next line'));
    assert.ok(!out.includes('Never referenced'));
    assert.strictEqual((out.match(/id="fn-/g) || []).length, 1);
  });

  test('footnotes: text without footnotes is returned unchanged', () => {
    const md = '# Title\n\nAn array index a[^1] with no definition, and `[^x]: code`.\n';
    assert.strictEqual(applyFootnotes(md), md);
    assert.strictEqual(applyFootnotes('plain'), 'plain');
    assert.strictEqual(applyFootnotes(''), '');
  });

  test('parser.parseMarkdownToHtml: footnotes render as a linked list with the note formatted', () => {
    const html = parseMarkdownToHtml('# Doc\n\nClaim[^src].\n\n[^src]: See *the paper* at <https://example.com>.\n');
    assert.ok(html.includes('<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup>'));
    assert.ok(
      /<section class="footnotes">\s*<ol>\s*<li><span id="fn-1"><\/span>See <em>the paper<\/em> at <a href="https:\/\/example.com">/.test(html)
    );
    assert.ok(html.includes('class="footnote-backref"'));
    assert.ok(html.includes('.footnotes {'));
  });

  test('extension: ships the same footnote code as the CLI', () => {
    const root = path.join(__dirname, '..');
    assert.strictEqual(
      fs.readFileSync(path.join(root, 'extension/lib/footnotes.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'src/core/footnotes.js'), 'utf8')
    );
    const preview = fs.readFileSync(path.join(root, 'extension/preview/preview.js'), 'utf8');
    assert.ok(preview.includes('MdPdfFootnotes.applyFootnotes('));
  });

  // A throwaway folder of files that import each other.
  const includeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-include-'));
  const write = (name, text) => {
    const file = path.join(includeDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    return file;
  };
  const mainFile = write(
    'main.md',
    '---\ntitle: Book\n---\n# Book\n\n@import "chapters/one.md"\n\n@import \'code/app.js\'\n\nEnd.\n'
  );
  write('chapters/one.md', '---\ntitle: ignored\n---\n## One\n\n@import "../shared/note.md"\n');
  write('shared/note.md', 'A shared note.\n');
  write('code/app.js', 'const tick = `a`;\n');

  test('include: Markdown files are inserted without front matter, relative to the importing file', () => {
    const { content, files } = expandIncludes(fs.readFileSync(mainFile, 'utf8'), mainFile);
    assert.ok(content.startsWith('---\ntitle: Book\n---\n# Book\n\n## One\n\nA shared note.\n\n'));
    assert.ok(!content.includes('title: ignored'));
    assert.ok(!content.includes('@import'));
    assert.ok(content.endsWith('\n\nEnd.\n'));
    assert.deepStrictEqual(
      files.map(file => path.relative(includeDir, file).replace(/\\/g, '/')).sort(),
      ['chapters/one.md', 'code/app.js', 'shared/note.md']
    );
  });

  test('include: other files become a fenced code block that their own backticks cannot close', () => {
    const { content } = expandIncludes('@import "code/app.js"', mainFile);
    assert.strictEqual(content, '```js\nconst tick = `a`;\n```');
    write('code/fence.txt', 'before\n````\ninner\n````\n');
    assert.ok(expandIncludes('@import "code/fence.txt"', mainFile).content.startsWith('`````txt\n'));
  });

  test('include: a line inside a code block or inside a sentence is not an import', () => {
    const source =
      'Use @import "x.md" like this:\n\n```md\n@import "missing.md"\n```\n\n~~~\n@import "missing.md"\n~~~\n';
    assert.strictEqual(expandIncludes(source, mainFile).content, source);
  });

  test('include: a missing file, a folder and a loop are reported with the line they are on', () => {
    assert.throws(
      () => expandIncludes('# T\n\n@import "nope.md"\n', mainFile),
      /Cannot import "nope\.md" \(.*main\.md:3\): file not found/
    );
    assert.throws(() => expandIncludes('@import "chapters"', mainFile), /file not found/);
    const loopA = write('loop-a.md', '@import "loop-b.md"\n');
    write('loop-b.md', '@import "loop-a.md"\n');
    assert.throws(
      () => expandIncludes(fs.readFileSync(loopA, 'utf8'), loopA),
      /import each other \(loop-a\.md → loop-b\.md → loop-a\.md\)/
    );
  });

  await asyncTest('core.convertMarkdownToPdf: imported files are part of the output and are listed', async () => {
    const outFile = path.join(includeDir, 'book.html');
    const result = await convertMarkdownToPdf(mainFile, outFile, { format: 'html' });
    const html = fs.readFileSync(outFile, 'utf8');
    assert.ok(html.includes('A shared note.'));
    assert.ok(/<code class="hljs language-js">/.test(html));
    assert.strictEqual(result.includedFiles.length, 3);

    const plain = await convertMarkdownToPdf(mainFile, outFile, { format: 'html', include: false });
    assert.deepStrictEqual(plain.includedFiles, []);
    assert.ok(fs.readFileSync(outFile, 'utf8').includes('@import'));
    fs.rmSync(includeDir, { recursive: true, force: true });
  });

  test('utils.preprocessMarkdown: a callout takes the text of the line below without its quote marker', () => {
    assert.strictEqual(
      preprocessMarkdown('> [!NOTE]\n> First line.\n> Second line.\n'),
      '> **ℹ️ NOTE:** First line.\n> Second line.\n'
    );
    // A callout with nothing under it keeps its line break, so the next paragraph stays outside.
    assert.strictEqual(preprocessMarkdown('> [!TIP]\n\nAfter.'), '> **💡 TIP:** \n\nAfter.');
    assert.ok(!parseMarkdownToHtml('> [!WARNING]\n> Careful.\n').includes('&gt; Careful'));
  });

  // Strict enough to catch what breaks Word and e-readers: an unclosed or crossed tag, a bare
  // `<` or `&`, an attribute without quotes.
  function assertWellFormed(source, name) {
    const body = source.replace(/<\?xml[^?]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');
    const pattern = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|<|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g;
    const open = [];
    for (const match of body.matchAll(pattern)) {
      if (!match[2]) {
        assert.fail(`${name}: stray "${match[0]}" near "${body.slice(Math.max(0, match.index - 30), match.index + 30)}"`);
      }
      if (match[4]) continue;
      if (match[1]) assert.strictEqual(open.pop(), match[2], `${name}: </${match[2]}> closes the wrong element`);
      else open.push(match[2]);
    }
    assert.deepStrictEqual(open, [], `${name}: elements left open`);
  }

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-export-'));
  // A 2 x 3 PNG: only its header is read.
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(2, 16);
  png.writeUInt32BE(3, 20);
  fs.writeFileSync(path.join(exportDir, 'pic.png'), png);
  const exportSource = [
    '---', 'title: Sample Book', 'author: A & B', 'lang: vi', '---',
    '# One',
    '',
    'Text with **bold**, *italic*, `a<b & c`, H<sub>2</sub>O, a [link](https://example.com/?a=1&b=2),',
    'a [jump](#two-été) and a note[^n]. An unclosed <b>tag and a <custom-tag>custom</custom-tag> one.',
    '',
    '![Pic](pic.png) ![Far](https://example.com/far.png)',
    '',
    '- bullet',
    '  - nested',
    '- [x] done',
    '',
    '3. three',
    '4. four',
    '',
    '| L | R |', '|:--|--:|', '| `x` | **1** |',
    '',
    '```js', 'const a = 1 < 2 && "q";', '```',
    '',
    '> [!NOTE]', '> Quoted.',
    '',
    '<!-- pagebreak -->',
    '',
    '# Two été',
    '',
    '<div class="box">Raw <em>block</em><br>second line</div>',
    '',
    '[^n]: The *note*.',
    ''
  ].join('\n');

  test('docmodel.buildDocument: Markdown becomes blocks of flat runs', () => {
    const { meta, blocks } = buildDocument(exportSource, {});
    assert.deepStrictEqual(
      { title: meta.title, author: meta.author, language: meta.language },
      { title: 'Sample Book', author: 'A & B', language: 'vi' }
    );
    assert.deepStrictEqual(
      blocks.map(block => block.type),
      ['heading', 'paragraph', 'paragraph', 'list', 'list', 'table', 'code', 'quote', 'pageBreak', 'heading', 'paragraph', 'rule', 'list']
    );
    assert.deepStrictEqual(blocks.filter(block => block.type === 'heading').map(block => block.id), ['one', 'two-été']);
    const runs = blocks[1].runs;
    assert.deepStrictEqual(runs.find(run => run.bold), { text: 'bold', bold: true });
    assert.deepStrictEqual(runs.find(run => run.code), { text: 'a<b & c', code: true });
    assert.deepStrictEqual(runs.find(run => run.sub), { text: '2', sub: true });
    assert.deepStrictEqual(runs.find(run => run.href === 'https://example.com/?a=1&b=2'), { text: 'link', href: 'https://example.com/?a=1&b=2' });
    // The footnote number is superscript text, not a link into a file that has no such anchor.
    assert.deepStrictEqual(runs.find(run => run.sup), { text: '1', sup: true });
    // The unclosed <b> is in force to the end of its paragraph and no further.
    assert.strictEqual(runs[runs.length - 1].bold, true);
    assert.ok(!blocks[2].runs.some(run => run.bold));
    assert.deepStrictEqual(blocks[3].items.map(item => item.checked), [null, true]);
    assert.strictEqual(blocks[4].start, 3);
    assert.deepStrictEqual(blocks[5].rows[0].map(cell => cell.align), ['left', 'right']);
    assert.deepStrictEqual(blocks[10].runs, [
      { text: 'Raw ' }, { text: 'block', italic: true }, { lineBreak: true }, { text: 'second line' }
    ]);
    // The note keeps its formatting and loses the arrow that linked back to the text.
    assert.strictEqual(plainText(blocks[12].items[0].blocks[0].runs), 'The note.');
  });

  test('zip.createZip: entries are readable, in order, and stored when asked', () => {
    const AdmZip = require('adm-zip');
    const archive = createZip([
      { name: 'mimetype', data: 'application/epub+zip', store: true },
      { name: 'folder/tệp.txt', data: 'x'.repeat(5000) }
    ]);
    const entries = new AdmZip(archive).getEntries();
    assert.deepStrictEqual(entries.map(entry => entry.entryName), ['mimetype', 'folder/tệp.txt']);
    assert.strictEqual(entries[0].header.method, 0);
    assert.strictEqual(entries[1].getData().toString('utf8'), 'x'.repeat(5000));
    assert.ok(archive.length < 1000);
    // The EPUB signature: the uncompressed media type sits at byte 38.
    assert.strictEqual(archive.toString('ascii', 30, 58), 'mimetypeapplication/epub+zip');
  });

  test('docx.markdownToDocx: a Word package with real styles, lists, a table and the image', () => {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(markdownToDocx(exportSource, { baseDir: exportDir, toc: true, cover: true, pageSize: 'Letter', orientation: 'landscape' }));
    const read = name => zip.readAsText(name);
    const names = zip.getEntries().map(entry => entry.entryName);
    assert.deepStrictEqual(names, [
      '[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/document.xml', 'word/styles.xml',
      'word/numbering.xml', 'word/_rels/document.xml.rels', 'word/media/image1.png'
    ]);
    for (const name of names.filter(entry => /\.(xml|rels)$/.test(entry))) assertWellFormed(read(name), name);

    const body = read('word/document.xml');
    assert.ok(body.includes('<w:pStyle w:val="Title"/>'));
    assert.ok(/<w:pStyle w:val="Heading1"\/><\/w:pPr><w:bookmarkStart w:id="1" w:name="h_one"\/>/.test(body));
    assert.ok(body.includes('<w:hyperlink w:anchor="h_two__t_"'), 'a link to a heading points at its bookmark');
    assert.ok(body.includes('<w:pStyle w:val="ContentsEntry"/>'));
    assert.ok(body.includes('<w:t xml:space="preserve">a&lt;b &amp; c</w:t>'));
    assert.ok(body.includes('<w:vertAlign w:val="subscript"/>'));
    assert.ok(body.includes('<w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>'), 'the nested bullet is one level in');
    assert.ok(body.includes('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'));
    assert.ok(body.includes('☑ '));
    assert.ok(body.includes('<w:tbl>') && body.includes('<w:jc w:val="right"/>'));
    assert.ok(body.includes('<w:pStyle w:val="CodeBlock"/>'));
    assert.ok(body.includes('<w:pStyle w:val="Quote"/>'));
    assert.ok(body.includes('<w:br w:type="page"/>'));
    // 2 x 3 pixels, in English Metric Units.
    assert.ok(body.includes('<wp:extent cx="19050" cy="28575"/>'));
    assert.ok(body.includes('[Far (https://example.com/far.png)]'), 'an image that is not a local file is named');
    assert.ok(body.includes('<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>'));

    assert.ok(read('word/numbering.xml').includes('<w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/></w:lvlOverride>'));
    assert.ok(read('word/_rels/document.xml.rels').includes('Target="https://example.com/?a=1&amp;b=2" TargetMode="External"'));
    assert.ok(read('docProps/core.xml').includes('<dc:creator>A &amp; B</dc:creator>'));
    assert.ok(read('[Content_Types].xml').includes('<Default Extension="png" ContentType="image/png"/>'));
  });

  test('zip.crc32: the same checksum as zlib', () => {
    const zlib = require('zlib');
    for (const sample of ['', 'a', 'x'.repeat(5000), 'tệp ✓']) {
      const bytes = Buffer.from(sample, 'utf8');
      assert.strictEqual(crc32(bytes), zlib.crc32(bytes), JSON.stringify(sample));
    }
  });

  await asyncTest('zip.createZipAsync: a readable archive from an async deflate, stored entries kept as they are', async () => {
    const AdmZip = require('adm-zip');
    const zlib = require('zlib');
    const archive = await createZipAsync(
      [
        { name: 'mimetype', data: 'application/epub+zip', store: true },
        { name: 'folder/tệp.txt', data: 'x'.repeat(5000) },
        { name: 'bytes.bin', data: new Uint8Array([1, 2, 3]) }
      ],
      async bytes => zlib.deflateRawSync(bytes)
    );
    assert.ok(archive instanceof Uint8Array);
    const entries = new AdmZip(Buffer.from(archive)).getEntries();
    assert.deepStrictEqual(entries.map(entry => entry.entryName), ['mimetype', 'folder/tệp.txt', 'bytes.bin']);
    assert.strictEqual(entries[0].header.method, 0);
    assert.strictEqual(entries[1].getData().toString('utf8'), 'x'.repeat(5000));
    assert.deepStrictEqual([...entries[2].getData()], [1, 2, 3]);
  });

  // The extension's Word export runs the core writer in the page, with no Node at hand.
  const extensionRoot = path.join(__dirname, '..', 'extension');
  function loadExtensionDocx() {
    const vm = require('vm');
    const context = vm.createContext({ TextEncoder, CompressionStream, console });
    for (const file of ['lib/marked.min.js', 'lib/docx-export.js']) {
      vm.runInContext(fs.readFileSync(path.join(extensionRoot, file), 'utf8'), context, { filename: file });
    }
    return context;
  }

  test('extension: ships the Word writer bundled from src/core, up to date', () => {
    const { bundleDocx } = require('../scripts/bundle-docx');
    assert.strictEqual(
      fs.readFileSync(path.join(extensionRoot, 'lib/docx-export.js'), 'utf8'),
      bundleDocx(),
      'extension/lib/docx-export.js is out of date: run `npm run fetch:libs`'
    );
    const page = fs.readFileSync(path.join(extensionRoot, 'preview/preview.html'), 'utf8');
    assert.ok(page.indexOf('<script src="../lib/marked.min.js"></script>') < page.indexOf('<script src="../lib/docx-export.js"></script>'));
    assert.ok(page.includes('id="btn-download-docx"'));
    assert.ok(fs.readFileSync(path.join(extensionRoot, 'preview/preview.js'), 'utf8').includes('MdPdfDocx.exportDocx('));
  });

  await asyncTest('extension: the Word export in the page writes the same document as the CLI', async () => {
    const AdmZip = require('adm-zip');
    const context = loadExtensionDocx();
    for (const name of ['require', 'module', 'Buffer', 'process']) assert.strictEqual(typeof context[name], 'undefined', name);
    const options = { toc: true, cover: true, pageSize: 'Letter', orientation: 'landscape' };
    // The page hands over the pictures it has; here, the ones the CLI would read.
    const readImage = src => readLocalImage(src, exportDir);
    const fromPage = new AdmZip(Buffer.from(await context.MdPdfDocx.exportDocx(exportSource, { ...options, readImage })));
    const fromCli = new AdmZip(markdownToDocx(exportSource, { ...options, baseDir: exportDir }));
    const names = fromCli.getEntries().map(entry => entry.entryName);
    assert.deepStrictEqual(fromPage.getEntries().map(entry => entry.entryName), names);
    for (const name of names) assert.ok(fromPage.readFile(name).equals(fromCli.readFile(name)), name);

    // Without pictures it still works, and names the picture as the CLI does for a web one.
    const bare = new AdmZip(Buffer.from(await context.MdPdfDocx.exportDocx('# T\n\n![Pic](pic.png)\n')));
    assert.ok(bare.readAsText('word/document.xml').includes('[Pic (pic.png)]'));
  });

  test('epub.markdownToEpub: an EPUB 3 package split into chapters of well-formed XHTML', () => {
    const AdmZip = require('adm-zip');
    const archive = markdownToEpub(exportSource, { baseDir: exportDir, cover: true });
    assert.strictEqual(archive.toString('ascii', 30, 58), 'mimetypeapplication/epub+zip');
    const zip = new AdmZip(archive);
    const read = name => zip.readAsText(name);
    const names = zip.getEntries().map(entry => entry.entryName);
    assert.deepStrictEqual(names, [
      'mimetype', 'META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/toc.ncx', 'OEBPS/style.css',
      'OEBPS/cover.xhtml', 'OEBPS/chapter-1.xhtml', 'OEBPS/chapter-2.xhtml', 'OEBPS/images/image-1.png'
    ]);
    for (const name of names.filter(entry => /\.(xml|opf|ncx|xhtml)$/.test(entry))) assertWellFormed(read(name), name);

    const first = read('OEBPS/chapter-1.xhtml');
    assert.ok(first.includes('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="vi" xml:lang="vi">'));
    assert.ok(first.includes('<h1 id="one">One</h1>'));
    assert.ok(first.includes('<code>a&lt;b &amp; c</code>'));
    assert.ok(first.includes('<a href="chapter-2.xhtml#two-%C3%A9t%C3%A9">jump</a>'), 'a link to a heading names the chapter it is in');
    assert.ok(first.includes('<img src="images/image-1.png" alt="Pic"/>'));
    assert.ok(first.includes('<a href="https://example.com/far.png">Far</a>'), 'an image on the web becomes a link');
    assert.ok(first.includes('<ol start="3">'));
    assert.ok(first.includes('<td style="text-align: right"><strong>1</strong></td>'));
    assert.ok(first.includes('<span class="hljs-keyword">const</span>'));
    assert.ok(first.includes('<strong>tag and a custom one.</strong>'), 'an unclosed tag cannot leave the page malformed');
    assert.ok(read('OEBPS/chapter-2.xhtml').includes('<h1 id="two-été">Two été</h1>'));

    const opf = read('OEBPS/content.opf');
    assert.ok(opf.includes('<dc:title>Sample Book</dc:title>') && opf.includes('<dc:language>vi</dc:language>'));
    assert.ok(/<dc:identifier id="book-id">urn:uuid:[0-9a-f-]{36}<\/dc:identifier>/.test(opf));
    assert.ok(/<meta property="dcterms:modified">\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ<\/meta>/.test(opf));
    // Without --toc the contents page is the reader's menu only, not a page of the book.
    assert.ok(opf.includes('<spine toc="ncx">\n<itemref idref="cover"/>\n<itemref idref="chapter-1"/>'));
    const withContents = new AdmZip(markdownToEpub(exportSource, { toc: true })).readAsText('OEBPS/content.opf');
    assert.ok(withContents.includes('<spine toc="ncx">\n<itemref idref="nav"/>\n<itemref idref="chapter-1"/>'));
    // A link to a neighbouring file or to a heading that does not exist keeps its text only.
    const loose = new AdmZip(markdownToEpub('See [the guide](docs/guide.md) and [nowhere](#missing).')).readAsText('OEBPS/chapter-1.xhtml');
    assert.ok(loose.includes('<p>See the guide and nowhere.</p>'));
    const looseDocx = new AdmZip(markdownToDocx('See [the guide](docs/guide.md).')).readAsText('word/document.xml');
    assert.ok(!looseDocx.includes('<w:hyperlink'));
    assert.ok(read('OEBPS/nav.xhtml').includes('<li><a href="chapter-2.xhtml#two-%C3%A9t%C3%A9">Two été</a></li>'));
    assert.ok(read('OEBPS/toc.ncx').includes('<navPoint id="nav-2" playOrder="2">'));
  });

  // Diagrams and formulas in Word and EPUB. What the page would draw is stood in for here: KaTeX
  // (from node_modules) writes the MathML, and the 2 x 3 PNG is the picture of every diagram.
  const katexLib = require('katex');
  const { collectMedia, mediaLookup } = require('../src/core/docmodel');
  const { parseMathml, serializeMathml, mathmlToOmml } = require('../src/core/omml');
  const mediaSource = [
    '# Drawn',
    '',
    '```mermaid',
    'flowchart LR',
    '  A[Start] --> B{Ok?}',
    '```',
    '',
    String.raw`Inline $E = mc^2$ and $\alpha_1$, a price of $5, \$x\$ and ` + '`$code$`.',
    '',
    '$$',
    String.raw`\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}`,
    '$$',
    '',
    '| Name | Formula |',
    '| --- | :-: |',
    String.raw`| Area | $\pi r^2$ |`,
    ''
  ].join('\n');
  const drawFor = (jobs, { failDiagrams = false } = {}) => ({
    diagrams: jobs.diagrams.map(() => (failDiagrams ? { error: 'Parse error' } : { png: png.toString('base64'), width: 640, height: 200 })),
    formulas: jobs.formulas.map(formula => ({
      mathml: katexLib.renderToString(formula.tex, { output: 'mathml', displayMode: formula.display, throwOnError: true })
    }))
  });

  test('docmodel: Mermaid code is a diagram and formulas are math, as typed in code', () => {
    const { blocks } = buildDocument(mediaSource, {});
    assert.deepStrictEqual(blocks[1], { type: 'diagram', text: 'flowchart LR\n  A[Start] --> B{Ok?}' });
    const runs = blocks[2].runs;
    assert.deepStrictEqual(runs[1], { math: { tex: 'E = mc^2', display: false, raw: '$E = mc^2$' } });
    assert.strictEqual(runs[3].math.tex, String.raw`\alpha_1`, 'the underscore is not emphasis');
    assert.strictEqual(runs[4].text, ', a price of $5, $x$ and ');
    assert.deepStrictEqual(runs[5], { text: '$code$', code: true });
    assert.deepStrictEqual(blocks[3], {
      type: 'math',
      tex: String.raw`\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}`,
      raw: '$$\n' + String.raw`\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}` + '\n$$'
    });
    assert.ok(blocks[4].rows[0][1].runs[0].math, 'a formula in a table cell');

    const jobs = collectMedia(blocks);
    assert.deepStrictEqual(jobs.diagrams, ['flowchart LR\n  A[Start] --> B{Ok?}']);
    assert.deepStrictEqual(jobs.formulas.map(formula => `${formula.display}:${formula.tex}`), [
      'false:E = mc^2', String.raw`false:\alpha_1`, String.raw`true:\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}`, String.raw`false:\pi r^2`
    ]);
    // `--no-katex` and `--no-mermaid` keep them as text and code, as before.
    const off = buildDocument(mediaSource, { katex: false, mermaid: false }).blocks;
    assert.strictEqual(off[1].type, 'code');
    assert.ok(!JSON.stringify(off).includes('"math"'));
    assert.deepStrictEqual(collectMedia(off), { diagrams: [], formulas: [] });
  });

  test('omml: KaTeX MathML becomes Office Math, and clean MathML for EPUB', () => {
    const omml = (tex, display = false) =>
      mathmlToOmml(parseMathml(katexLib.renderToString(tex, { output: 'mathml', displayMode: display })), display);
    const wrapped = body => `<w:p xmlns:w="w" xmlns:m="m">${body}</w:p>`;
    const cases = {
      [String.raw`\frac{a}{b}`]: '<m:f><m:num>',
      [String.raw`\binom{n}{k}`]: '<m:type m:val="noBar"/>',
      [String.raw`\sqrt{x}`]: '<m:degHide m:val="1"/>',
      [String.raw`\sqrt[3]{x}`]: '<m:deg><m:r>',
      'x^2': '<m:sSup>',
      'x_i': '<m:sSub>',
      'x_i^2': '<m:sSubSup>',
      [String.raw`\left(\alpha\right)`]: '<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/>',
      [String.raw`\hat{x}`]: '<m:acc><m:accPr><m:chr m:val="̂"/>',
      [String.raw`\overline{AB}`]: '<m:bar><m:barPr><m:pos m:val="top"/>',
      [String.raw`\sin x`]: '<m:func><m:fName>',
      [String.raw`\mathbb{R}`]: '<m:scr m:val="double-struck"/>',
      [String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`]: '<m:m><m:mPr><m:mcs>',
      [String.raw`\text{if } x`]: '<m:rPr><m:nor/></m:rPr>'
    };
    for (const [tex, expected] of Object.entries(cases)) {
      const out = omml(tex);
      assert.ok(out.includes(expected), `${tex}: ${out}`);
      assertWellFormed(wrapped(out), tex);
    }
    // A sum takes the term after it as its body, with its limits under and over in display.
    const sum = omml(String.raw`\sum_{i=1}^{n} x_i = 1`, true);
    assert.ok(sum.startsWith('<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath><m:nary>'), sum);
    assert.ok(/<m:chr m:val="∑"\/><m:limLoc m:val="undOvr"\/>.*<\/m:sup><m:e><m:sSub>.*<\/m:e><\/m:nary><m:r>.*=/.test(sum), sum);
    assert.ok(omml(String.raw`\int_0^1 f(x)\,dx`).includes('<m:limLoc m:val="subSup"/>'));
    // A one-letter name is italic, a longer one upright.
    assert.ok(omml('x').includes('<m:r><w:rPr>'));
    assert.ok(omml(String.raw`\operatorname{rank}`).includes('<m:sty m:val="p"/>'));

    const math = parseMathml(katexLib.renderToString('a < b', { output: 'mathml' }));
    const xhtml = serializeMathml(math, true);
    assert.ok(xhtml.startsWith('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" alttext="a &lt; b">'), xhtml);
    assertWellFormed(xhtml, 'MathML');
    assert.strictEqual(parseMathml('<span>no math</span>'), null);
    assert.strictEqual(parseMathml('<math><mi>x</mo></math>'), null, 'not well formed');
  });

  test('docx: drawn diagrams are pictures and formulas Word equations, with valid relationships', () => {
    const AdmZip = require('adm-zip');
    const jobs = collectMedia(buildDocument(mediaSource, {}).blocks);
    const media = mediaLookup(jobs, drawFor(jobs));
    const zip = new AdmZip(markdownToDocx(mediaSource, { media }));
    const document = zip.readAsText('word/document.xml');
    const rels = zip.readAsText('word/_rels/document.xml.rels');
    assertWellFormed(document, 'document.xml');
    assertWellFormed(rels, 'document.xml.rels');

    // The picture part, its content type and the relationship the drawing points at.
    assert.ok(zip.getEntry('word/media/image1.png').getData().equals(png));
    assert.ok(zip.readAsText('[Content_Types].xml').includes('<Default Extension="png" ContentType="image/png"/>'));
    const relations = new Map([...rels.matchAll(/<Relationship Id="([^"]+)" Type="([^"]+)" Target="([^"]+)"/g)].map(m => [m[1], { type: m[2], target: m[3] }]));
    assert.strictEqual(relations.size, [...rels.matchAll(/<Relationship /g)].length, 'relationship ids are unique');
    const embeds = [...document.matchAll(/r:(?:embed|id)="([^"]+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(embeds, ['rId1']);
    for (const id of embeds) {
      const relation = relations.get(id);
      assert.ok(relation, `${id} is a relationship`);
      assert.ok(relation.type.endsWith('/relationships/image'));
      assert.ok(zip.getEntry(`word/${relation.target}`), `${relation.target} is in the package`);
    }
    // Shown at its own size (640 x 200 px) on a paragraph of its own, described by its source.
    assert.ok(document.includes(`<wp:extent cx="${640 * 9525}" cy="${200 * 9525}"/>`));
    assert.ok(document.includes('<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing>'));
    assert.ok(document.includes('descr="flowchart LR&#10;  A[Start] --&gt; B{Ok?}"'), 'line breaks kept');
    assert.ok(!document.includes('A[Start]</w:t>'), 'the source is not written out as code');

    // Equations: in the text, on a line of their own, and alone in a table cell (aligned as the column).
    assert.ok(document.includes('xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'));
    assert.ok(/Inline <\/w:t><\/w:r><m:oMath>.*?<m:t xml:space="preserve">E<\/m:t>/.test(document));
    assert.ok(document.includes('<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath><m:nary>'));
    assert.ok(/<w:jc w:val="center"\/><\/w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="center"\/>/.test(document), 'cell');
    assert.ok(document.includes('a price of $5, $x$ and '));
    assert.strictEqual((document.match(/<m:oMath>/g) || []).length, 4);

    // A diagram that could not be drawn stays as its source; a formula without MathML as typed.
    const failed = new AdmZip(markdownToDocx(mediaSource, { media: mediaLookup(jobs, drawFor(jobs, { failDiagrams: true })) }));
    assert.ok(!failed.getEntry('word/media/image1.png'));
    const bare = new AdmZip(markdownToDocx(mediaSource)).readAsText('word/document.xml');
    assert.ok(bare.includes('<w:pStyle w:val="CodeBlock"/></w:pPr><w:r><w:t xml:space="preserve">flowchart LR</w:t>'));
    assert.ok(bare.includes('>$E = mc^2$</w:t>') && bare.includes('>$\\alpha_1$</w:t>') && !bare.includes('<m:oMath>'));
  });

  test('epub: drawn diagrams are pictures and formulas MathML', () => {
    const AdmZip = require('adm-zip');
    const jobs = collectMedia(buildDocument(mediaSource, {}).blocks);
    const zip = new AdmZip(markdownToEpub(mediaSource, { media: mediaLookup(jobs, drawFor(jobs)) }));
    const chapter = zip.readAsText('OEBPS/chapter-1.xhtml');
    assertWellFormed(chapter, 'chapter-1.xhtml');
    assert.ok(zip.getEntry('OEBPS/images/diagram-1.png').getData().equals(png));
    const opf = zip.readAsText('OEBPS/content.opf');
    assert.ok(opf.includes('<item id="chapter-1" href="chapter-1.xhtml" media-type="application/xhtml+xml" properties="mathml"/>'));
    assert.ok(opf.includes('<item id="image-1" href="images/diagram-1.png" media-type="image/png"/>'));
    assert.ok(chapter.includes('<figure class="diagram"><img src="images/diagram-1.png" width="640" alt="flowchart LR&#10;  A[Start] --&gt; B{Ok?}"/></figure>'));
    assert.ok(chapter.includes('Inline <math xmlns="http://www.w3.org/1998/Math/MathML" alttext="E = mc^2"><semantics>'));
    assert.ok(chapter.includes('<div class="math"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"'));
    // Without them drawn: the source as code and the formulas as typed, and no MathML flag.
    const bare = new AdmZip(markdownToEpub(mediaSource));
    assert.ok(!bare.readAsText('OEBPS/content.opf').includes('properties="mathml"'));
    assert.ok(bare.readAsText('OEBPS/chapter-1.xhtml').includes('<p>Inline $E = mc^2$'));
  });

  await asyncTest('extension: the Word export draws formulas with lib/media.js and matches the CLI', async () => {
    const AdmZip = require('adm-zip');
    assert.strictEqual(
      fs.readFileSync(path.join(extensionRoot, 'lib/media.js'), 'utf8'),
      fs.readFileSync(path.join(__dirname, '..', 'src/core/media.js'), 'utf8'),
      'extension/lib/media.js is out of date: run `npm run fetch:libs`'
    );
    const page = fs.readFileSync(path.join(extensionRoot, 'preview/preview.html'), 'utf8');
    assert.ok(page.indexOf('<script src="../lib/mermaid.min.js"></script>') < page.indexOf('<script src="../lib/media.js"></script>'));
    assert.ok(fs.readFileSync(path.join(extensionRoot, 'preview/preview.js'), 'utf8').includes('MdPdfMedia.renderMedia('));

    // The page's script, with KaTeX: formulas only, since a diagram needs a real canvas.
    const context = loadExtensionDocx();
    context.atob = atob;
    const vm = require('vm');
    vm.runInContext(fs.readFileSync(path.join(extensionRoot, 'lib/media.js'), 'utf8'), context, { filename: 'lib/media.js' });
    const source = mediaSource.replace(/```mermaid[\s\S]*?```\n/, '');
    const jobs = context.MdPdfDocx.mediaJobs(source, {});
    const drawn = await context.MdPdfMedia.renderMedia(jobs, { katex: katexLib, mermaid: null, document: {} });
    assert.strictEqual(drawn.formulas.length, 4);
    const fromPage = new AdmZip(Buffer.from(await context.MdPdfDocx.exportDocx(source, { media: context.MdPdfDocx.mediaLookup(jobs, drawn) })));
    const fromCli = new AdmZip(markdownToDocx(source, { media: mediaLookup(collectMedia(buildDocument(source, {}).blocks), drawFor(jobs)) }));
    assert.strictEqual(fromPage.readAsText('word/document.xml'), fromCli.readAsText('word/document.xml'));
    assert.ok(fromPage.readAsText('word/document.xml').includes('<m:oMathPara>'));
    // Without Mermaid loaded a diagram is reported, not thrown.
    const missing = await context.MdPdfMedia.renderMedia({ diagrams: ['flowchart LR'], formulas: [] }, { document: {} });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(missing)), { diagrams: [{ error: 'Mermaid is not loaded' }], formulas: [] });
  });

  test('images: a file:// address finds the picture on macOS, Linux and Windows alike', () => {
    // The two forms, read the same way on any system.
    assert.strictEqual(fileUrlPath('file:///home/u/my%20pic.png', false), '/home/u/my pic.png');
    assert.strictEqual(fileUrlPath('file://localhost/Users/u/%E1%BA%A3nh.png', false), '/Users/u/ảnh.png');
    assert.strictEqual(fileUrlPath('file:///C:/Users/u/my%20pic.png', true), 'C:\\Users\\u\\my pic.png');
    assert.strictEqual(fileUrlPath('file://C:/Users/u/a.png?x=1#y', true), 'C:\\Users\\u\\a.png');
    assert.strictEqual(fileUrlPath('file:///home/u/100%.png', false), '/home/u/100%.png');
    assert.strictEqual(fileUrlPath('file:///home/u/a.png', true), null, 'no drive on Windows');
    assert.strictEqual(fileUrlPath('file://server/share/a.png', false), null, 'no shares outside Windows');

    // A real file, by its absolute address, from a document somewhere else.
    const picDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-file-url-'));
    const picPath = path.join(picDir, 'my pic.png');
    fs.writeFileSync(picPath, png);
    const address = pathToFileURL(picPath).href;
    assert.ok(address.startsWith(process.platform === 'win32' ? 'file:///' + picDir.slice(0, 2) : 'file:///'));
    const image = readLocalImage(address, os.homedir());
    assert.ok(image, `${address} is read`);
    assert.deepStrictEqual(image.size, { width: 2, height: 3 });
    const docx = new (require('adm-zip'))(markdownToDocx(`![p](${address})`, { baseDir: os.homedir() }));
    assert.ok(docx.getEntry('word/media/image1.png'), 'the picture is in the DOCX');
    const epub = new (require('adm-zip'))(markdownToEpub(`![p](${address})`, { baseDir: os.homedir() }));
    assert.ok(epub.getEntry('OEBPS/images/image-1.png'), 'the picture is in the EPUB');
    fs.rmSync(picDir, { recursive: true, force: true });
  });

  await asyncTest('core.convertMarkdownToPdf: docx and epub are written without a browser; an unknown format is refused', async () => {
    const source = path.join(exportDir, 'book.md');
    fs.writeFileSync(source, exportSource, 'utf8');
    for (const [format, signature] of [['docx', '[Content_Types].xml'], ['epub', 'mimetype']]) {
      const result = await convertMarkdownToPdf(source, null, { format });
      assert.strictEqual(result.outputPath, path.join(exportDir, `book.${format}`));
      // Nothing to draw: no browser is started, and nothing to warn about.
      assert.deepStrictEqual(result.warnings, []);
      const bytes = fs.readFileSync(result.outputPath);
      assert.strictEqual(bytes.readUInt32LE(0), 0x04034b50);
      assert.strictEqual(bytes.toString('ascii', 30, 30 + signature.length), signature);
      // The image next to the Markdown file is found without a baseDir being passed.
      assert.ok(bytes.includes(png));
    }
    await assert.rejects(convertMarkdownToPdf(source, null, { format: 'odt' }), /Unknown output format "odt"/);
    fs.rmSync(exportDir, { recursive: true, force: true });
  });

  await asyncTest('core.convertMarkdownToPdf: Word and EPUB get Mermaid and math drawn by the headless browser', async () => {
    const { findBrowserExecutable } = require('../src/browser/renderer');
    const { imageSize } = require('../src/core/images');
    if (!findBrowserExecutable()) {
      console.log('   (skipped: no Chrome, Edge or Chromium here)');
      return;
    }
    const AdmZip = require('adm-zip');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-media-'));
    const source = path.join(dir, 'drawn.md');
    // A second diagram Mermaid cannot read: kept as its source, and named in the warnings.
    fs.writeFileSync(source, `${mediaSource}\n\`\`\`mermaid\nnot a diagram\n\`\`\`\n`, 'utf8');
    try {
      const docx = await convertMarkdownToPdf(source, null, { format: 'docx' });
      if (docx.warnings.some(warning => warning.includes('cdn.jsdelivr.net'))) {
        console.log(`   (skipped: ${docx.warnings[0]})`);
        return;
      }
      assert.deepStrictEqual(docx.warnings.map(warning => warning.split(':')[0]), ['Mermaid diagram 2 is kept as its source']);
      const zip = new AdmZip(docx.outputPath);
      const picture = zip.getEntry('word/media/image1.png').getData();
      assert.strictEqual(picture.readUInt32BE(0), 0x89504e47);
      assert.ok(!zip.getEntry('word/media/image2.png'));
      const size = imageSize(picture);
      const document = zip.readAsText('word/document.xml');
      assertWellFormed(document, 'document.xml');
      // Drawn at twice the size it is shown at.
      const [, cx] = /<wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(document);
      assert.ok(Math.abs((Number(cx) / 9525) * 2 - size.width) <= 2, `${cx} EMU for ${size.width} px`);
      assert.strictEqual((document.match(/<m:oMath>/g) || []).length, 4);
      assert.ok(document.includes('<m:chr m:val="∑"/>'));
      assert.ok(document.includes('>not a diagram</w:t>'));

      const epub = await convertMarkdownToPdf(source, null, { format: 'epub' });
      const book = new AdmZip(epub.outputPath);
      assert.strictEqual(book.getEntry('OEBPS/images/diagram-1.png').getData().readUInt32BE(0), 0x89504e47);
      const chapter = book.readAsText('OEBPS/chapter-1.xhtml');
      assertWellFormed(chapter, 'chapter-1.xhtml');
      assert.strictEqual((chapter.match(/<math /g) || []).length, 4);
      assert.ok(book.readAsText('OEBPS/content.opf').includes('properties="mathml"'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Broken references (--strict)
  const { findBrokenReferences, formatProblem, htmlIds } = require('../src/core/references');
  const strictDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-strict-'));
  fs.mkdirSync(path.join(strictDir, '.git'));
  fs.mkdirSync(path.join(strictDir, 'docs'));
  fs.writeFileSync(path.join(strictDir, 'pic.png'), 'png');
  fs.writeFileSync(path.join(strictDir, 'my pic.png'), 'png');
  fs.writeFileSync(path.join(strictDir, 'docs', 'a.pdf'), 'pdf');
  const strictFile = path.join(strictDir, 'doc.md');
  const brief = (problems) => problems.map(problem => `${problem.kind} ${problem.line} ${problem.reference}`);

  await asyncTest('references: missing pictures, dead local links, unknown anchors and footnotes are found with their lines', async () => {
    const markdown = [
      '---',
      'title: T',
      '---',
      '# Intro',
      '',
      '![a](pic.png) ![b](missing.png) ![c](my%20pic.png?v=2) ![d](data:image/png;base64,AAAA)',
      '',
      '[a](./other.md) [b](docs/a.pdf) [c](docs) [d](docs/a.pdf#page=2) [e](https://example.com/x.md) [f](mailto:a@b.c)',
      '',
      '[a](#intro) [b](#nope) [c](#top) [d](#)',
      '',
      '> - quoted <img alt="x" src="gone.png"> and <a href="gone.md">gone</a>',
      '',
      '| a | b |',
      '|---|---|',
      '| ![t](cell.png) | [ref][later] |',
      '',
      '[later]: later.md',
      '',
      'One[^1], two[^two], `[^code]` and three[^none].',
      '',
      '[^1]: See',
      '[^two]: A note',
      '  that goes on.',
      '',
      '```md',
      '![x](in-code.png) [y](in-code.md) [z](#in-code) [^in-code]',
      '```',
      '',
      'Inline `![x](in-span.png)` and a formula $a[i](in-math.md)$.'
    ].join('\n');
    const problems = await findBrokenReferences(markdown, { file: strictFile, ids: ['intro'], math: true });
    assert.deepStrictEqual(brief(problems), [
      'image 6 missing.png',
      'link 8 ./other.md',
      'anchor 10 #nope',
      'image 12 gone.png',
      'link 12 gone.md',
      'image 16 cell.png',
      'link 16 later.md',
      'footnote 20 [^none]'
    ]);
    assert.strictEqual(formatProblem(problems[0]), `${strictFile}:6: image cannot be loaded (file not found): missing.png`);
    assert.strictEqual(problems[1].message, 'linked file not found: ./other.md');
    assert.strictEqual(problems[2].message, 'no heading has the anchor #nope');
    assert.strictEqual(problems[7].message, 'footnote has no definition: [^none]');

    // Without the formulas taken out, the link inside the formula is one the converter writes.
    const plain = await findBrokenReferences('$a[i](in-math.md)$', { file: strictFile });
    assert.deepStrictEqual(brief(plain), ['link 1 in-math.md']);
    assert.deepStrictEqual(await findBrokenReferences('# Fine\n\n![a](pic.png) [b](#fine)', { file: strictFile, ids: ['fine'] }), []);
  });

  await asyncTest('references: absolute paths and file: addresses are looked up as the exporters do', async () => {
    const there = path.join(strictDir, 'my pic.png');
    const gone = path.join(strictDir, 'gone.png');
    const markdown = [
      `![a](${pathToFileURL(there).href})`,
      `![b](${pathToFileURL(gone).href})`,
      `![c](<${there}>)`,
      `![d](<${gone}>)`,
      '![e](docs)'
    ].join('\n');
    // From another folder: nothing here depends on where the document is.
    const problems = await findBrokenReferences(markdown, { file: path.join(os.homedir(), 'doc.md') });
    assert.deepStrictEqual(brief(problems).slice(0, 2), [`image 2 ${pathToFileURL(gone).href}`, `image 4 ${gone}`]);
    const folder = await findBrokenReferences('![e](docs)', { file: strictFile });
    assert.strictEqual(folder[0].message, 'image cannot be loaded (not a file): docs');
  });

  await asyncTest('references: a problem in an imported file is reported with that file and its own line', async () => {
    fs.writeFileSync(path.join(strictDir, 'part.md'), '---\ntitle: Part\n---\n## Part\n\n![p](part-missing.png)\n\n@import "deep.md"\n');
    fs.writeFileSync(path.join(strictDir, 'deep.md'), 'Deep [x](deep-missing.md)\n');
    const main = '# Main\n\n@import "part.md"\n\n[after](after-missing.md)\n';
    const expanded = expandIncludes(main, strictFile);
    assert.strictEqual(expanded.origins.length, expanded.content.split('\n').length);
    const problems = await findBrokenReferences(expanded.content, { file: strictFile, origins: expanded.origins });
    assert.deepStrictEqual(
      problems.map(problem => `${path.basename(problem.file)}:${problem.line} ${problem.reference}`),
      ['part.md:6 part-missing.png', 'deep.md:1 deep-missing.md', 'doc.md:5 after-missing.md']
    );
  });

  await asyncTest('references: a web picture is asked for only on request, and one that does not answer is reported', async () => {
    const http = require('http');
    let requests = 0;
    const server = http.createServer((request, response) => {
      requests += 1;
      response.statusCode = { '/ok.png': 200, '/gone.png': 404, '/private.png': 403 }[request.url] || 500;
      response.end('x');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const closed = http.createServer();
    await new Promise(resolve => closed.listen(0, '127.0.0.1', resolve));
    const dead = `http://127.0.0.1:${closed.address().port}/x.png`;
    await new Promise(resolve => closed.close(resolve));

    const markdown = `![a](${base}/ok.png)\n![b](${base}/gone.png)\n![c](${base}/private.png)\n![d](${dead})\n![b](${base}/gone.png)`;
    try {
      assert.deepStrictEqual(await findBrokenReferences(markdown, { file: strictFile }), []);
      assert.strictEqual(requests, 0);
      const problems = await findBrokenReferences(markdown, { file: strictFile, remote: true });
      assert.deepStrictEqual(brief(problems), [`image 2 ${base}/gone.png`, `image 4 ${dead}`, `image 5 ${base}/gone.png`]);
      assert.strictEqual(problems[0].message, `image cannot be loaded (the server answered 404): ${base}/gone.png`);
      assert.strictEqual(problems[1].message, `image cannot be loaded (no answer): ${dead}`);
      // Each address is asked for once.
      assert.strictEqual(requests, 3);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });

  await asyncTest('core.convertMarkdownToPdf: strict writes nothing for a document with broken references, in every format', async () => {
    assert.deepStrictEqual([...htmlIds('<h1 id="a">A</h1><a name=\'b\'></a><p>id="no"</p>')], ['a', 'b']);
    fs.writeFileSync(strictFile, '# Intro\n\n## Second part\n\n![m](missing.png) [d](./other.md) [a](#nope) [ok](#second-part)\n');
    for (const format of ['html', 'docx', 'epub']) {
      const out = path.join(strictDir, `doc.${format}`);
      await assert.rejects(convertMarkdownToPdf(strictFile, null, { format, strict: true, toc: true }), (error) => {
        assert.strictEqual(error.code, 'BROKEN_REFERENCES');
        assert.deepStrictEqual(brief(error.problems), ['image 5 missing.png', 'link 5 ./other.md', 'anchor 5 #nope']);
        assert.ok(error.message.includes(`${strictFile}:5: no heading has the anchor #nope`));
        return true;
      });
      assert.ok(!fs.existsSync(out), `${format}: nothing is written`);
      // Without strict the same document is converted as before.
      await convertMarkdownToPdf(strictFile, null, { format, toc: true });
      assert.ok(fs.existsSync(out));
      fs.unlinkSync(out);
    }
    assert.ok(!fs.readdirSync(strictDir).some(name => name.startsWith('_temp_')));

    // The anchors are those of the output: HTML and PDF headings get theirs from the contents list.
    const anchors = path.join(strictDir, 'anchors.md');
    fs.writeFileSync(anchors, '# Intro\n\n## Second part\n\n[ok](#second-part) ![p](pic.png) [f](docs/a.pdf) Note[^1].\n\n[^1]: The note.\n');
    for (const format of ['docx', 'epub']) {
      const result = await convertMarkdownToPdf(anchors, null, { format, strict: true });
      assert.ok(fs.existsSync(result.outputPath));
    }
    assert.ok(fs.existsSync((await convertMarkdownToPdf(anchors, null, { format: 'html', strict: true, toc: true })).outputPath));
    fs.unlinkSync(path.join(strictDir, 'anchors.html'));
    await assert.rejects(convertMarkdownToPdf(anchors, null, { format: 'html', strict: true }), (error) => {
      assert.deepStrictEqual(brief(error.problems), ['anchor 5 #second-part']);
      assert.ok(error.problems[0].message.includes('--toc'));
      return true;
    });
    assert.ok(!fs.existsSync(path.join(strictDir, 'anchors.html')));
  });

  test('cli: --strict lists every broken reference, leaves that file unwritten and exits 1; .mdpdfrc can set it', () => {
    const { spawnSync } = require('child_process');
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const cli = (...args) => spawnSync(process.execPath, [cliPath, ...args], { cwd: strictDir, encoding: 'utf8' });
    fs.writeFileSync(path.join(strictDir, 'bad.md'), '# Bad\n\n![m](missing.png)\n\n[d](./other.md)\n\n[a](#nope)\n');
    fs.writeFileSync(path.join(strictDir, 'good.md'), '# Good\n\n![p](pic.png) [f](docs/a.pdf) [a](#good)\n');
    const bad = path.join(strictDir, 'bad.md');

    for (const format of ['docx', 'html']) {
      const strict = cli('bad.md', 'good.md', '-f', format, '--toc', '--strict', '-o', 'out');
      assert.strictEqual(strict.status, 1, strict.stdout);
      assert.ok(strict.stderr.includes(`${bad}:3: image cannot be loaded (file not found): missing.png`), strict.stderr);
      assert.ok(strict.stderr.includes(`${bad}:5: linked file not found: ./other.md`));
      assert.ok(strict.stderr.includes(`${bad}:7: no heading has the anchor #nope`));
      assert.ok(strict.stderr.includes('--strict: 3 broken reference(s); 1 of 2 file(s) not written.'));
      assert.ok(!fs.existsSync(path.join(strictDir, 'out', `bad.${format}`)));
      // The other file is still checked and, being whole, written.
      assert.ok(fs.existsSync(path.join(strictDir, 'out', `good.${format}`)));

      const loose = cli('bad.md', '-f', format, '--toc', '-o', 'out');
      assert.strictEqual(loose.status, 0, loose.stderr);
      assert.strictEqual(loose.stderr, '');
      assert.ok(fs.existsSync(path.join(strictDir, 'out', `bad.${format}`)));
      fs.rmSync(path.join(strictDir, 'out'), { recursive: true, force: true });
    }

    fs.writeFileSync(path.join(strictDir, '.mdpdfrc'), JSON.stringify({ format: 'html', strict: true }));
    const fromConfig = cli('bad.md');
    assert.strictEqual(fromConfig.status, 1);
    assert.ok(fromConfig.stderr.includes('missing.png'));
    assert.ok(!fs.existsSync(path.join(strictDir, 'bad.html')));
    assert.strictEqual(cli('bad.md', '--no-config', '-f', 'html').status, 0);
    assert.ok(cli('--help').stdout.includes('--strict'));
    fs.rmSync(strictDir, { recursive: true, force: true });
  });

  // Obsidian syntax: ==highlight==, [[wikilinks]], ![[embeds]] and callouts (src/core/obsidian.js).
  const obsidianSyntax = require('../src/core/obsidian');
  const body = html => html.slice(html.indexOf('<body'));

  test('obsidian: ==highlight== is marked; a == b, ===, code spans and code blocks stay as written', () => {
    const html = body(parseMarkdownToHtml(
      '# T\n\nA ==bright **bold** idea== here; a == b, x ==== y.\n\nUse `==x==` and `[[x]]`.\n\n' +
      '```js\nif (a == b) { list[[0]] = "==x=="; }\n```\n\n    indented ==x== [[y]] ![[z.png]]\n'
    ));
    assert.ok(html.includes('<mark>bright <strong>bold</strong> idea</mark>'), html);
    assert.ok(html.includes('a == b, x ==== y.'));
    assert.ok(html.includes('<code>==x==</code>') && html.includes('<code>[[x]]</code>'));
    assert.ok(html.includes('list[[') && html.includes('&quot;==x==&quot;'), html);
    assert.ok(html.includes('indented ==x== [[y]] ![[z.png]]'));
    assert.strictEqual((html.match(/<mark>/g) || []).length, 1);
    assert.ok(!html.includes('wikilink') && !html.includes('obsidian-embed'));
  });

  test('obsidian: wikilinks without a vault lead to headings of the document, other notes are muted text', () => {
    const html = body(parseMarkdownToHtml(
      '# Intro\n\n## Second Part\n\nSee [[#Second Part]], [[#Second Part|there]], [[Other note]], ' +
      '[[Other note#Sec|alias]] and [[#Nowhere]].\n'
    ));
    // The link gives the headings their anchors, as --toc would.
    assert.ok(html.includes('<h2 id="second-part">'), html);
    assert.ok(html.includes('<a class="wikilink" href="#second-part">Second Part</a>'));
    assert.ok(html.includes('<a class="wikilink" href="#second-part">there</a>'));
    assert.ok(html.includes('<span class="wikilink wikilink-unresolved">Other note</span>'));
    assert.ok(html.includes('<span class="wikilink wikilink-unresolved">alias</span>'));
    assert.ok(html.includes('<span class="wikilink">Nowhere</span>'));
    // The text is escaped.
    assert.ok(body(parseMarkdownToHtml('[[x|a "q" <i>]]')).includes('>a &quot;q&quot; &lt;i&gt;</span>'));
  });

  test('obsidian: plain Markdown is unchanged: links, task lists, footnotes, alerts, reference links', () => {
    const plain = [
      fs.readFileSync(path.join(__dirname, '..', 'examples', 'sample.md'), 'utf8'),
      '# Doc\n\n[link](https://example.com) [[1]](https://x.y/1) [[a]][ref] [x]\n\n[ref]: https://ref.example\n',
      '- [ ] open\n- [x] done\n\nNote[^1].\n\n[^1]: The note.\n\n> [!NOTE]\n> GitHub alert\n\n> [!WARNING]\n> Careful\n',
      'Math $a == b$ and $$x == y$$ stay math; prices $5 and $10.\n\n```\n[[code]] ==code== ![[code.png]]\n```\n'
    ].join('\n\n');
    for (const options of [{}, { toc: true }, { cover: true, katex: false }]) {
      assert.strictEqual(
        parseMarkdownToHtml(plain, { ...options, obsidian: true }),
        parseMarkdownToHtml(plain, { ...options, obsidian: false })
      );
    }
    const html = body(parseMarkdownToHtml(plain));
    assert.ok(html.includes('<a href="https://x.y/1">[1]</a>'), html);
    assert.ok(html.includes('<a href="https://ref.example">[a]</a>'));
    assert.ok(html.includes('<input checked="" disabled="" type="checkbox"> done'));
  });

  test('obsidian: picture embeds take a size and alt text; [[a\\|b]] works in a table', () => {
    const html = body(parseMarkdownToHtml(
      '![[my pic.png]] ![[img/a.jpg|300]] ![[b.png|A caption|40x20]] ![[c.webp|wide]]\n\n' +
      '| Link | Mark |\n| --- | --- |\n| [[#T\\|go]] | ==hot== |\n'
    ));
    assert.ok(html.includes('<img class="obsidian-embed" src="my%20pic.png" alt="my pic.png">'), html);
    assert.ok(html.includes('<img class="obsidian-embed" src="img/a.jpg" alt="a.jpg" width="300">'));
    assert.ok(html.includes('<img class="obsidian-embed" src="b.png" alt="A caption" width="40" height="20">'));
    assert.ok(html.includes('alt="wide"'));
    assert.ok(/<td><span class="wikilink">go<\/span><\/td>\s*<td><mark>hot<\/mark><\/td>/.test(html), html);
  });

  test('obsidian: callouts get their icon and title; GitHub alerts look as before; code is left alone', () => {
    const html = body(parseMarkdownToHtml(
      '> [!tip] Remember this\n> The body.\n\n> [!warning]- Folded\n> Hidden\n\n> [!question]\n> Why?\n\n' +
      '> [!NOTE]\n> GitHub style\n\n```md\n> [!tip] In code\n```\n'
    ));
    assert.ok(html.includes('<strong>💡 Remember this</strong><br>The body.'), html);
    assert.ok(html.includes('<strong>⚠️ Folded</strong><br>Hidden'));
    assert.ok(html.includes('<strong>❓ Question</strong><br>Why?'));
    assert.ok(html.includes('<strong>ℹ️ NOTE:</strong> GitHub style'));
    assert.ok(html.includes('&gt; [!tip] In code'));
  });

  test('obsidian: off by option or front matter, an option wins', () => {
    const source = '# T\n\n==hi== [[#T]] ![[a.png]]\n\n> [!tip] Title\n';
    for (const html of [
      parseMarkdownToHtml(source, { obsidian: false }),
      parseMarkdownToHtml(`---\nobsidian: false\n---\n${source}`)
    ]) {
      assert.ok(body(html).includes('==hi== [[#T]] ![[a.png]]'), html);
      assert.ok(body(html).includes('[!tip] Title'));
      assert.ok(body(html).includes('<h1 id="heading-1">'));
    }
    assert.ok(parseMarkdownToHtml(`---\nobsidian: false\n---\n${source}`, { obsidian: true }).includes('<mark>hi</mark>'));
  });

  test('obsidian: Word and EPUB keep highlights, wikilinks and picture embeds', () => {
    const AdmZip = require('adm-zip');
    const source = '# Start\n\n## Next Step\n\nA ==hot== word, [[#Next Step|on]] and [[Elsewhere]]. `==no==`\n\n![[pic.png|200]]\n';
    const { blocks } = buildDocument(source, {});
    const runs = blocks[2].runs;
    assert.deepStrictEqual(runs.find(run => run.mark), { text: 'hot', mark: true });
    assert.deepStrictEqual(runs.find(run => run.href), { text: 'on', href: '#next-step' });
    assert.ok(runs.some(run => run.text && run.text.includes('Elsewhere')));
    assert.deepStrictEqual(runs.find(run => run.code), { text: '==no==', code: true });
    assert.deepStrictEqual(blocks[3].runs, [{ image: { src: 'pic.png', alt: 'pic.png' } }]);
    assert.ok(!buildDocument(source, { obsidian: false }).blocks[2].runs.some(run => run.mark || run.href));

    const picDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-obsidian-'));
    fs.writeFileSync(path.join(picDir, 'pic.png'), png);
    const docx = new AdmZip(markdownToDocx(source, { baseDir: picDir })).readAsText('word/document.xml');
    assert.ok(/<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">hot<\/w:t>/.test(docx), docx);
    assert.ok(docx.includes('<w:hyperlink w:anchor="h_next_step"'));
    assert.ok(docx.includes('<w:drawing>'), 'the picture beside the file is embedded');

    const epub = new AdmZip(markdownToEpub(source, { baseDir: picDir }));
    const chapters = epub.getEntries().filter(entry => entry.entryName.endsWith('.xhtml')).map(entry => entry.getData().toString('utf8')).join('');
    assert.ok(chapters.includes('<mark>hot</mark>'));
    assert.ok(/<a href="[^"]*#next-step">on<\/a>/.test(chapters), chapters);
    assert.ok(epub.getEntries().some(entry => /images\/.*\.png$/.test(entry.entryName)));
    fs.rmSync(picDir, { recursive: true, force: true });
  });

  // A vault: notes that link to and embed each other, and pictures in an attachments folder.
  const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-vault-'));
  const vaultWrite = (name, text) => {
    const file = path.join(vaultDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  fs.mkdirSync(path.join(vaultDir, '.obsidian'));
  const vaultMain = vaultWrite(
    'notes/Main.md',
    '# Main\n\nSee [[Sibling]], [[Sibling#Part Two|part two]], [[Embedded]], [[Missing note]] and [[#Main]].\n\n' +
      '![[Embedded]]\n\n![[Sibling#Part Two]]\n\n![[photo one.png|120]] ![[logo.png]] ![[gone.png]]\n\n' +
      '```\n![[Embedded]]\n```\n\nInline ![[Sibling]] stays a link.\n'
  );
  vaultWrite('notes/Embedded.md', '---\ntitle: skipped\n---\n# Embedded Title\n\nEmbedded ==text==.\n\n![[Main]]\n');
  vaultWrite('notes/Sibling.md', '# Sibling\n\nIntro.\n\n## Part Two\n\nSecond part.\n\n### Deeper\n\nStill two.\n\n## Part Three\n\nNot this.\n');
  vaultWrite('notes/Chain1.md', '# C1\n\n![[Chain2]]\n');
  vaultWrite('notes/Chain2.md', '# C2\n\n![[Chain3]]\n');
  vaultWrite('notes/Chain3.md', '# C3\n\n![[Chain4]]\n');
  vaultWrite('notes/Chain4.md', '# C4\n\nToo deep.\n');
  vaultWrite('notes/photo one.png', png);
  vaultWrite('attachments/logo.png', png);

  test('obsidian: ![[Note]] puts the note in; a section, a loop, depth > 3 and a missing note are handled', () => {
    const source = fs.readFileSync(vaultMain, 'utf8');
    const { content, files, origins } = expandIncludes(source, vaultMain, { embeds: true });
    assert.ok(content.includes('\n# Embedded Title\n\nEmbedded ==text==.\n'), content);
    assert.ok(!content.includes('title: skipped'));
    // The note that embeds Main back is not put in twice: that line stays a link.
    assert.strictEqual((content.match(/^# Main$/gm) || []).length, 1);
    assert.ok(content.includes('\n![[Main]]\n'));
    // Only the section asked for, with its subsections.
    assert.ok(content.includes('## Part Two\n\nSecond part.\n\n### Deeper\n\nStill two.\n'));
    assert.ok(!content.includes('Not this.') && !content.includes('Intro.'));
    // Code blocks and embeds inside a sentence are left alone.
    assert.ok(content.includes('```\n![[Embedded]]\n```'));
    assert.ok(content.includes('Inline ![[Sibling]] stays a link.'));
    assert.deepStrictEqual(files.map(file => path.basename(file)).sort(), ['Embedded.md', 'Sibling.md']);
    const embeddedLine = content.split('\n').indexOf('Embedded ==text==.');
    assert.deepStrictEqual(origins[embeddedLine], { file: path.join(vaultDir, 'notes', 'Embedded.md'), line: 6 });

    const chain = path.join(vaultDir, 'notes', 'Chain1.md');
    const nested = expandIncludes(fs.readFileSync(chain, 'utf8'), chain, { embeds: true }).content;
    assert.ok(nested.includes('# C2') && nested.includes('# C3') && nested.includes('# C4'), nested);
    const deeper = vaultWrite('notes/Chain0.md', '# C0\n\n![[Chain1]]\n');
    const tooDeep = expandIncludes(fs.readFileSync(deeper, 'utf8'), deeper, { embeds: true }).content;
    assert.ok(tooDeep.includes('# C3') && tooDeep.includes('![[Chain4]]') && !tooDeep.includes('Too deep.'), tooDeep);
    // Embeds are off unless asked for, and imports can be off on their own.
    assert.strictEqual(expandIncludes(source, vaultMain).content, source);
    assert.strictEqual(expandIncludes('@import "x.md"\n![[Sibling]]', vaultMain, { imports: false }).content, '@import "x.md"\n![[Sibling]]');
    assert.strictEqual(
      expandIncludes('![[Missing]]\n![[Sibling#No such part]]', vaultMain, { embeds: true }).content,
      '![[Missing]]\n![[Sibling#No such part]]'
    );
  });

  await asyncTest('core.convertMarkdownToPdf: Obsidian notes and pictures are found in the vault', async () => {
    const out = path.join(vaultDir, 'main.html');
    const result = await convertMarkdownToPdf(vaultMain, out, { format: 'html' });
    const html = body(fs.readFileSync(out, 'utf8'));
    // A note in this output leads to its heading; one beside it to its file; a missing one is muted text.
    assert.ok(html.includes('<a class="wikilink" href="#embedded-title">Embedded</a>'), html);
    assert.ok(html.includes('<a class="wikilink" href="#part-two">part two</a>'));
    // Only a section of Sibling is here, without its first heading: the link goes to its file.
    assert.ok(html.includes('<a class="wikilink" href="Sibling.md">Sibling</a>'));
    assert.ok(html.includes('<span class="wikilink wikilink-unresolved">Missing note</span>'));
    assert.ok(html.includes('<a class="wikilink" href="#main">Main</a>'));
    assert.ok(html.includes('<mark>text</mark>'));
    // Pictures: beside the note, anywhere in the vault by name, or muted text when there is none.
    assert.ok(html.includes('<img class="obsidian-embed" src="photo%20one.png" alt="photo one.png" width="120">'));
    assert.ok(html.includes('<img class="obsidian-embed" src="../attachments/logo.png" alt="logo.png">'));
    assert.ok(html.includes('<span class="wikilink wikilink-unresolved">gone.png</span>'));
    assert.ok(html.includes('<pre><code>![[Embedded]]\n</code></pre>'));
    // Watch mode follows the embedded notes.
    assert.deepStrictEqual(result.includedFiles.map(file => path.basename(file)).sort(), ['Embedded.md', 'Sibling.md']);

    // A note beside it that is not in this output: a link to its file.
    const lone = vaultWrite('notes/Lone.md', '# Lone\n\nGo to [[Chain4]] or [[Chain4#C4|its top]].\n');
    await convertMarkdownToPdf(lone, out, { format: 'html' });
    const loneHtml = fs.readFileSync(out, 'utf8');
    assert.ok(loneHtml.includes('<a class="wikilink" href="Chain4.md">Chain4</a>'), loneHtml);
    assert.ok(loneHtml.includes('<a class="wikilink" href="Chain4.md#c4">its top</a>'));

    const AdmZip = require('adm-zip');
    const docx = new AdmZip((await convertMarkdownToPdf(vaultMain, path.join(vaultDir, 'main.docx'), { format: 'docx' })).outputPath);
    const xml = docx.readAsText('word/document.xml');
    assert.strictEqual((xml.match(/<w:drawing>/g) || []).length, 2, 'both pictures found are embedded');
    assert.ok(xml.includes('Embedded Title') && xml.includes('w:highlight'));

    const off = await convertMarkdownToPdf(vaultMain, out, { format: 'html', obsidian: false });
    assert.deepStrictEqual(off.includedFiles, []);
    assert.ok(fs.readFileSync(out, 'utf8').includes('<p>![[Embedded]]</p>'));
  });

  test('cli: --no-obsidian and "obsidian": false in .mdpdfrc read Obsidian syntax as plain Markdown', () => {
    const { spawnSync } = require('child_process');
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const cli = (...args) => spawnSync(process.execPath, [cliPath, ...args], { cwd: path.join(vaultDir, 'notes'), encoding: 'utf8' });
    const read = () => fs.readFileSync(path.join(vaultDir, 'notes', 'Main.html'), 'utf8');
    assert.strictEqual(cli('Main.md', '-f', 'html', '--no-config').status, 0);
    assert.ok(read().includes('class="wikilink"'));
    assert.strictEqual(cli('Main.md', '-f', 'html', '--no-config', '--no-obsidian').status, 0);
    assert.ok(!read().includes('class="wikilink"') && read().includes('[[Sibling]]'));
    fs.writeFileSync(path.join(vaultDir, 'notes', '.mdpdfrc'), JSON.stringify({ format: 'html', obsidian: false }));
    assert.strictEqual(cli('Main.md').status, 0);
    assert.ok(!read().includes('class="wikilink"'));
    assert.ok(cli('--help').stdout.includes('--no-obsidian'));
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  test('extension: ships the same Obsidian code as the CLI; the preview and popup use it', () => {
    const root = path.join(__dirname, '..');
    assert.strictEqual(
      fs.readFileSync(path.join(root, 'extension/lib/obsidian.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'src/core/obsidian.js'), 'utf8')
    );
    const page = fs.readFileSync(path.join(root, 'extension/preview/preview.html'), 'utf8');
    assert.ok(page.includes('<script src="../lib/obsidian.js"></script>'));
    const preview = fs.readFileSync(path.join(root, 'extension/preview/preview.js'), 'utf8');
    assert.ok(preview.includes('MdPdfObsidian.markedExtension(') && preview.includes('MdPdfObsidian.applyCallouts('));
    assert.ok(preview.includes('obsidian: options.obsidian !== false'), 'the Word export follows the setting');
    assert.ok(fs.readFileSync(path.join(root, 'extension/popup/popup.html'), 'utf8').includes('id="chk-obsidian" checked'));
    assert.ok(fs.readFileSync(path.join(root, 'extension/popup/popup.js'), 'utf8').includes('obsidian: chkObsidian'));
    // Loaded as a classic script it defines MdPdfObsidian.
    const vm = require('vm');
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'extension/lib/obsidian.js'), 'utf8'), context);
    assert.strictEqual(typeof context.MdPdfObsidian.markedExtension, 'function');
    assert.strictEqual(obsidianSyntax.slugify('Två Ways: été!'), 'två-ways-été');
  });

  await asyncTest('extension: the Word export in the page reads Obsidian syntax as the CLI does', async () => {
    const AdmZip = require('adm-zip');
    const context = loadExtensionDocx();
    const source = '# Start\n\n## Next\n\n==hot== [[#Next|go]] [[Other]]\n\n> [!tip] Title\n> body\n\n`==code==`\n';
    for (const options of [{}, { obsidian: false }]) {
      const fromPage = new AdmZip(Buffer.from(await context.MdPdfDocx.exportDocx(source, options)));
      const fromCli = new AdmZip(markdownToDocx(source, options));
      assert.strictEqual(fromPage.readAsText('word/document.xml'), fromCli.readAsText('word/document.xml'));
    }
    const xml = new AdmZip(Buffer.from(await context.MdPdfDocx.exportDocx(source, {}))).readAsText('word/document.xml');
    assert.ok(xml.includes('w:highlight') && xml.includes('w:anchor="h_next"') && xml.includes('💡 Title'));
  });

  console.log(`\n\x1b[33mSummary:\x1b[0m ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
