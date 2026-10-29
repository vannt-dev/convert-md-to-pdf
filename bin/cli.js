#!/usr/bin/env node
/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { convertMarkdownToPdf } = require('../src/core/index');
const { normalizePageNumbersArgs, parseMarginText } = require('../src/cli/options');
const { findConfigFile, layerOptions, loadConfig } = require('../src/cli/config');
const { parseFrontMatter } = require('../src/core/utils');
const packageJson = require('../package.json');

const OUTPUT_FORMATS = ['pdf', 'html', 'docx', 'epub'];
// An --output that names a file rather than a folder.
const OUTPUT_FILE = /\.(pdf|html|docx|epub)$/i;
// The input name that reads the Markdown from stdin.
const STDIN = '-';

const program = new Command();

program
  .name('md-pdf-studio')
  .alias('md2pdf')
  .description('High-quality Markdown to PDF converter CLI with Mermaid, Math, TOC, Custom CSS, and Batch conversion.')
  .version(packageJson.version, '-v, --version', 'Output tool version')
  .argument('<inputs...>', 'Input Markdown file(s) or wildcard pattern (.md); - reads stdin')
  .option('-o, --output <path>', 'Output file path or destination directory')
  .option('-f, --format <format>', 'Output format: pdf (default), html, docx, epub', 'pdf')
  .option('-w, --watch', 'Watch input file(s) and recompile automatically on changes', false)
  .option('-t, --theme <theme>', 'Theme name: modern (default), dark, academic, minimal, github, ebook, cyberpunk', 'modern')
  .option('--font <font>', 'Font family: Inter (default), Roboto, Lora, Merriweather, JetBrains Mono, Fira Code', 'Inter')
  .option('--cover', 'Auto-generate elegant document Cover Page', false)
  .option('-p, --page-size <size>', 'Paper size: A4, Letter, A3, Legal', 'A4')
  .option('-l, --landscape', 'Use landscape orientation', false)
  .option('-m, --margin <margin>', 'Page margin (e.g. 14mm 12mm 16mm 12mm)', '14mm 12mm 16mm 12mm')
  .option('--toc', 'Auto-generate Table of Contents (TOC)', false)
  .option('--page-numbers [style]', 'Print page numbers in the footer: full ("Page 3 of 12", default) or simple ("3")')
  .option('--header <text>', 'Running header text; {title}, {author}, {date}, {page}, {pages} are filled in ("" for none)', parseMarginText)
  .option('--footer <text>', 'Running footer text, same placeholders ("" for none)', parseMarginText)
  .option('--watermark <text>', 'Faint diagonal text across every page, e.g. DRAFT (PDF and HTML; "" for none)', parseMarginText)
  .option('-c, --css <path>', 'Custom CSS stylesheet file path to inject')
  .option('-k, --keep-html', 'Keep temporary HTML file after conversion', false)
  .option('--no-mermaid', 'Disable Mermaid diagram rendering')
  .option('--no-katex', 'Disable KaTeX math formula rendering')
  .option('--no-highlight', 'Disable syntax highlighting of code blocks')
  .option('--no-include', 'Leave @import "file" lines as they are instead of inserting the file')
  .option('--no-outline', 'Leave out the PDF bookmarks (outline) made from the headings')
  .option('-b, --browser <path>', 'Custom Chrome/Edge executable path')
  .option('--config <path>', 'Project config file (default: .mdpdfrc or .mdpdfrc.json here or in a parent)')
  .option('--no-config', 'Do not read a project config file')
  .action(async (inputArgs, cliOptions) => {
    try {
      // Flags typed on the command line; commander's defaults are left out so that the front
      // matter and the config file can set those options.
      const flags = {};
      for (const [key, value] of Object.entries(cliOptions)) {
        if (program.getOptionValueSource(key) === 'cli') flags[key] = value;
      }
      let configFile = null;
      let config = {};
      if (cliOptions.config !== false) {
        configFile = cliOptions.config ? path.resolve(cliOptions.config) : findConfigFile(process.cwd());
        if (configFile) {
          const loaded = loadConfig(configFile);
          config = loaded.config;
          loaded.warnings.forEach(warning => console.error(`\x1b[33m⚠ Warning:\x1b[0m ${warning}`));
        }
      }
      // Options that do not depend on the front matter: flag, then config file, then default.
      const options = { format: 'pdf', theme: 'modern', font: 'Inter', pageSize: 'A4', ...layerOptions(flags, config) };

      const fromStdin = inputArgs.includes(STDIN);
      let stdinMarkdown = null;
      if (fromStdin) {
        if (inputArgs.length > 1) throw new Error('"-" (stdin) must be the only input.');
        if (options.watch) throw new Error('--watch cannot follow stdin; give a file instead of "-".');
        if (!options.output || !OUTPUT_FILE.test(options.output)) {
          throw new Error('Reading from stdin ("-") needs -o <file> naming the output, e.g. -o out.pdf');
        }
        if (process.stdin.isTTY) {
          throw new Error('No Markdown on stdin: pipe it in, e.g. cat a.md | md-pdf-studio - -o a.pdf');
        }
        stdinMarkdown = await readStdin();
      }

      // Files pulled in with @import, so watch mode can follow them too.
      const importedFiles = new Set();

      const runConversion = async () => {
        const startTime = Date.now();
        // Markdown from stdin is placed in the current folder, so relative paths resolve there.
        const inputFiles = fromStdin ? [path.join(process.cwd(), 'stdin.md')] : expandInputFiles(inputArgs);

        if (inputFiles.length === 0) {
          console.error('\x1b[31m✖ Error:\x1b[0m No valid Markdown files found matching input.');
          if (!options.watch) process.exit(1);
          return;
        }

        const targetFormat = (options.format || 'pdf').toLowerCase();
        if (!OUTPUT_FORMATS.includes(targetFormat)) {
          throw new Error(`Unknown format "${options.format}". Use one of: ${OUTPUT_FORMATS.join(', ')}`);
        }
        console.log(`\n\x1b[36m🚀 Converting ${inputFiles.length} file(s) to ${targetFormat.toUpperCase()}...\x1b[0m`);
        if (configFile) console.log(`   Config: ${configFile}`);
        console.log(`   Theme:  ${options.theme}`);
        console.log(`   Font:   ${options.font}`);
        console.log(`   Paper:  ${options.pageSize} (${options.landscape ? 'Landscape' : 'Portrait'})`);
        if (options.cover) console.log(`   Cover:  Auto-generated Cover Page Enabled`);
        if (options.toc) console.log(`   TOC:    Auto-generated Table of Contents Enabled`);
        if (options.watermark) console.log(`   Mark:   Watermark "${options.watermark}"`);
        if (options.pageNumbers) console.log(`   Pages:  Page numbers (${options.pageNumbers === true ? 'full' : options.pageNumbers})`);
        if (options.css) console.log(`   CSS:    ${path.resolve(options.css)}`);
        console.log('   (a file\'s front matter can change these for that file)');

        let targetOutputDir = null;
        if (options.output) {
          const resolvedOut = path.resolve(options.output);
          if (inputFiles.length === 1 && OUTPUT_FILE.test(resolvedOut)) {
            targetOutputDir = null;
          } else {
            targetOutputDir = resolvedOut;
            if (!fs.existsSync(targetOutputDir)) {
              fs.mkdirSync(targetOutputDir, { recursive: true });
            }
          }
        }

        let count = 0;
        for (const file of inputFiles) {
          const fileBaseName = path.parse(file).name;
          let fileOutPath = null;

          if (targetOutputDir) {
            fileOutPath = path.join(targetOutputDir, `${fileBaseName}.${targetFormat}`);
          } else if (options.output && OUTPUT_FILE.test(options.output)) {
            fileOutPath = options.output;
          }

          console.log(`[\x1b[33m${count + 1}/${inputFiles.length}\x1b[0m] Processing: ${fromStdin ? '(stdin)' : file}`);

          // Flags > this file's front matter > config file > built-in defaults. A key left
          // undefined here is decided by the front matter, then by the defaults in src/core.
          const markdown = fromStdin ? stdinMarkdown : fs.readFileSync(file, 'utf8');
          const fileOptions = layerOptions(flags, config, parseFrontMatter(markdown).data);
          const landscape = fileOptions.landscape;
          const result = await convertMarkdownToPdf(file, fileOutPath, {
            format: targetFormat,
            markdown,
            theme: fileOptions.theme,
            font: fileOptions.font,
            pageSize: fileOptions.pageSize,
            orientation: landscape === undefined ? undefined : landscape ? 'landscape' : 'portrait',
            margin: fileOptions.margin,
            toc: fileOptions.toc,
            cover: fileOptions.cover,
            header: fileOptions.header,
            footer: fileOptions.footer,
            pageNumbers: fileOptions.pageNumbers,
            watermark: fileOptions.watermark,
            cssFile: fileOptions.css,
            keepHtml: fileOptions.keepHtml,
            mermaid: fileOptions.mermaid,
            katex: fileOptions.katex,
            highlight: fileOptions.highlight,
            include: fileOptions.include,
            outline: fileOptions.outline,
            executablePath: fileOptions.browser
          });

          result.includedFiles.forEach(includedFile => importedFiles.add(includedFile));
          const outPathDisplay = result.outputPath;
          console.log(`   \x1b[32m✔ File saved:\x1b[0m ${outPathDisplay}`);
          count++;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\x1b[32m✨ Conversion complete!\x1b[0m ${count} file(s) generated in ${duration}s.`);
      };

      // Initial conversion
      await runConversion();

      // Watch mode implementation
      if (options.watch) {
        const inputFiles = expandInputFiles(inputArgs);
        console.log('\n\x1b[35m👀 Watch mode enabled. Monitoring files for changes...\x1b[0m');

        let debounceTimer = null;
        let watchImports = () => {};
        const triggerRecompile = (filename) => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            console.log(`\n\x1b[33m🔄 Change detected in ${filename}. Recompiling...\x1b[0m`);
            try {
              await runConversion();
              watchImports();
            } catch (err) {
              console.error(`\x1b[31m✖ Error during watch recompile:\x1b[0m ${err.message}`);
            }
          }, 300);
        };

        const watched = new Set();
        const watchFile = (filePath) => {
          if (watched.has(filePath) || !fs.existsSync(filePath)) return;
          watched.add(filePath);
          fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
              triggerRecompile(path.basename(filePath));
            }
          });
        };
        // An edit can add an @import, so the list is read again after every run.
        watchImports = () => importedFiles.forEach(watchFile);

        inputFiles.forEach(watchFile);
        watchImports();

        if (options.css && fs.existsSync(options.css)) {
          fs.watch(options.css, (eventType) => {
            if (eventType === 'change') {
              triggerRecompile(path.basename(options.css));
            }
          });
        }
      }
    } catch (err) {
      console.error(`\x1b[31m✖ Error:\x1b[0m ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Everything piped to stdin, as text.
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
}

function expandInputFiles(args) {
  const filesSet = new Set();

  args.forEach(arg => {
    // Check if direct file exists
    if (fs.existsSync(arg)) {
      const stat = fs.statSync(arg);
      if (stat.isFile() && (arg.endsWith('.md') || arg.endsWith('.markdown') || arg.endsWith('.txt'))) {
        filesSet.add(path.resolve(arg));
      } else if (stat.isDirectory()) {
        const dirFiles = fs.readdirSync(arg);
        dirFiles.forEach(f => {
          if (f.endsWith('.md') || f.endsWith('.markdown')) {
            filesSet.add(path.resolve(arg, f));
          }
        });
      }
    } else {
      // Handle simple wildcard pattern like *.md or docs/*.md
      const dir = path.dirname(arg) || '.';
      const pattern = path.basename(arg);

      if (fs.existsSync(dir)) {
        const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
        const dirFiles = fs.readdirSync(dir);
        dirFiles.forEach(f => {
          if (regexPattern.test(f) && (f.endsWith('.md') || f.endsWith('.markdown'))) {
            filesSet.add(path.resolve(dir, f));
          }
        });
      }
    }
  });

  return Array.from(filesSet);
}

program.parse(normalizePageNumbersArgs(process.argv));
