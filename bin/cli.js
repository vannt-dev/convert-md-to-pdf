#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { convertMarkdownToPdf } = require('../src/core/index');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('convert-md-to-pdf')
  .alias('md2pdf')
  .description('High-quality Markdown to PDF converter CLI with Mermaid, Math, TOC, Custom CSS, and Batch conversion.')
  .version(packageJson.version, '-v, --version', 'Output tool version')
  .argument('<inputs...>', 'Input Markdown file(s) or wildcard pattern (.md)')
  .option('-o, --output <path>', 'Output PDF/HTML file path or destination directory')
  .option('-f, --format <format>', 'Output format: pdf (default), html', 'pdf')
  .option('-w, --watch', 'Watch input file(s) and recompile automatically on changes', false)
  .option('-t, --theme <theme>', 'Theme name: modern (default), dark, academic, minimal, github, ebook, cyberpunk', 'modern')
  .option('--font <font>', 'Font family: Inter (default), Roboto, Lora, Merriweather, JetBrains Mono, Fira Code', 'Inter')
  .option('--cover', 'Auto-generate elegant document Cover Page', false)
  .option('-p, --page-size <size>', 'Paper size: A4, Letter, A3, Legal', 'A4')
  .option('-l, --landscape', 'Use landscape orientation', false)
  .option('-m, --margin <margin>', 'Page margin (e.g. 14mm 12mm 16mm 12mm)', '14mm 12mm 16mm 12mm')
  .option('--toc', 'Auto-generate Table of Contents (TOC)', false)
  .option('-c, --css <path>', 'Custom CSS stylesheet file path to inject')
  .option('-k, --keep-html', 'Keep temporary HTML file after conversion', false)
  .option('--no-mermaid', 'Disable Mermaid diagram rendering')
  .option('--no-katex', 'Disable KaTeX math formula rendering')
  .option('-b, --browser <path>', 'Custom Chrome/Edge executable path')
  .action(async (inputArgs, options) => {
    try {
      const runConversion = async () => {
        const startTime = Date.now();
        const inputFiles = expandInputFiles(inputArgs);

        if (inputFiles.length === 0) {
          console.error('\x1b[31m✖ Error:\x1b[0m No valid Markdown files found matching input.');
          if (!options.watch) process.exit(1);
          return;
        }

        const targetFormat = (options.format || 'pdf').toLowerCase();
        console.log(`\n\x1b[36m🚀 Converting ${inputFiles.length} file(s) to ${targetFormat.toUpperCase()}...\x1b[0m`);
        console.log(`   Theme:  ${options.theme}`);
        console.log(`   Font:   ${options.font}`);
        console.log(`   Paper:  ${options.pageSize} (${options.landscape ? 'Landscape' : 'Portrait'})`);
        if (options.cover) console.log(`   Cover:  Auto-generated Cover Page Enabled`);
        if (options.toc) console.log(`   TOC:    Auto-generated Table of Contents Enabled`);
        if (options.css) console.log(`   CSS:    ${path.resolve(options.css)}`);

        let targetOutputDir = null;
        if (options.output) {
          const resolvedOut = path.resolve(options.output);
          if (inputFiles.length === 1 && (resolvedOut.endsWith('.pdf') || resolvedOut.endsWith('.html'))) {
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
          } else if (options.output && (options.output.endsWith('.pdf') || options.output.endsWith('.html'))) {
            fileOutPath = options.output;
          }

          console.log(`[\x1b[33m${count + 1}/${inputFiles.length}\x1b[0m] Processing: ${file}`);

          const result = await convertMarkdownToPdf(file, fileOutPath, {
            format: targetFormat,
            theme: options.theme,
            font: options.font,
            pageSize: options.pageSize,
            orientation: options.landscape ? 'landscape' : 'portrait',
            margin: options.margin,
            toc: options.toc,
            cover: options.cover,
            cssFile: options.css,
            keepHtml: options.keepHtml,
            mermaid: options.mermaid,
            katex: options.katex,
            executablePath: options.browser
          });

          const outPathDisplay = result.pdfPath || result.htmlPath;
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
        const triggerRecompile = (filename) => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            console.log(`\n\x1b[33m🔄 Change detected in ${filename}. Recompiling...\x1b[0m`);
            try {
              await runConversion();
            } catch (err) {
              console.error(`\x1b[31m✖ Error during watch recompile:\x1b[0m ${err.message}`);
            }
          }, 300);
        };

        inputFiles.forEach(filePath => {
          if (fs.existsSync(filePath)) {
            fs.watch(filePath, (eventType) => {
              if (eventType === 'change') {
                triggerRecompile(path.basename(filePath));
              }
            });
          }
        });

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

program.parse(process.argv);
