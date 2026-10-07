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

  console.log(`\n\x1b[33mSummary:\x1b[0m ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
