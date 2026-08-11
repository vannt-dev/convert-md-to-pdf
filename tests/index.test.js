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

  // 6. HTML Parser Integration (Themes, Font & Cover)
  test('parser.parseMarkdownToHtml: integrates cover page, new themes & font options', () => {
    const md = `---\ntitle: Cover Title\nsubtitle: Subtitle Text\ncover: true\ntheme: ebook\nfont: Lora\ntoc: true\n---\n# Chapter 1\nSome paragraph text.`;
    const html = parseMarkdownToHtml(md);
    assert.ok(html.includes('<title>Cover Title</title>'));
    assert.ok(html.includes('class="cover-page"'));
    assert.ok(html.includes('Subtitle Text'));
    assert.ok(html.includes('font-family: \'Lora\''));
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

  console.log(`\n\x1b[33mSummary:\x1b[0m ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
