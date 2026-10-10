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
const { convertMarkdownToPdf } = require('../src/core/index');
const { expandIncludes } = require('../src/core/include');
const { buildDocument, plainText } = require('../src/core/docmodel');
const { createZip } = require('../src/core/zip');
const { markdownToDocx } = require('../src/core/docx');
const { markdownToEpub } = require('../src/core/epub');
const os = require('os');

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
    assert.ok(preview.includes('MdPdfFootnotes.applyFootnotes(markdownText)'));
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

  await asyncTest('core.convertMarkdownToPdf: docx and epub are written without a browser; an unknown format is refused', async () => {
    const source = path.join(exportDir, 'book.md');
    fs.writeFileSync(source, exportSource, 'utf8');
    for (const [format, signature] of [['docx', '[Content_Types].xml'], ['epub', 'mimetype']]) {
      const result = await convertMarkdownToPdf(source, null, { format });
      assert.strictEqual(result.outputPath, path.join(exportDir, `book.${format}`));
      const bytes = fs.readFileSync(result.outputPath);
      assert.strictEqual(bytes.readUInt32LE(0), 0x04034b50);
      assert.strictEqual(bytes.toString('ascii', 30, 30 + signature.length), signature);
      // The image next to the Markdown file is found without a baseDir being passed.
      assert.ok(bytes.includes(png));
    }
    await assert.rejects(convertMarkdownToPdf(source, null, { format: 'odt' }), /Unknown output format "odt"/);
    fs.rmSync(exportDir, { recursive: true, force: true });
  });

  console.log(`\n\x1b[33mSummary:\x1b[0m ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
