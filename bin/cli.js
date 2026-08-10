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
  .option('-o, --output <path>', 'Output PDF file path or destination directory')
  .option('-t, --theme <theme>', 'Theme name: modern (default), dark, academic, minimal', 'modern')
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
      const startTime = Date.now();
      
      // Resolve input files (handles multiple files & basic wildcard patterns)
      const inputFiles = expandInputFiles(inputArgs);

      if (inputFiles.length === 0) {
        console.error('\x1b[31m✖ Error:\x1b[0m No valid Markdown files found matching input.');
        process.exit(1);
      }

      console.log(`\x1b[36m🚀 Converting ${inputFiles.length} Markdown file(s) to PDF...\x1b[0m`);
      console.log(`   Theme:  ${options.theme}`);
      console.log(`   Paper:  ${options.pageSize} (${options.landscape ? 'Landscape' : 'Portrait'})`);
      if (options.toc) console.log(`   TOC:    Auto-generated Table of Contents Enabled`);
      if (options.css) console.log(`   CSS:    ${path.resolve(options.css)}`);

      let targetOutputDir = null;
      if (options.output) {
        const resolvedOut = path.resolve(options.output);
        // If output ends with .pdf and single input file
        if (inputFiles.length === 1 && resolvedOut.endsWith('.pdf')) {
          targetOutputDir = null; // explicit PDF path
        } else {
          // Output is a target directory
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
          fileOutPath = path.join(targetOutputDir, `${fileBaseName}.pdf`);
        } else if (options.output && options.output.endsWith('.pdf')) {
          fileOutPath = options.output;
        }

        console.log(`\n[\x1b[33m${count + 1}/${inputFiles.length}\x1b[0m] Processing: ${file}`);

        const result = await convertMarkdownToPdf(file, fileOutPath, {
          theme: options.theme,
          pageSize: options.pageSize,
          orientation: options.landscape ? 'landscape' : 'portrait',
          margin: options.margin,
          toc: options.toc,
          cssFile: options.css,
          keepHtml: options.keepHtml,
          mermaid: options.mermaid,
          katex: options.katex,
          executablePath: options.browser
        });

        console.log(`   \x1b[32m✔ PDF saved:\x1b[0m ${result.pdfPath}`);
        count++;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n\x1b[32m✨ Batch conversion complete!\x1b[0m ${count} PDF(s) generated in ${duration}s.`);
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
