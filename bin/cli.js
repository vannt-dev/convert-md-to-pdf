#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { convertMarkdownToPdf } = require('../src/index');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('convert-md-to-pdf')
  .alias('md2pdf')
  .description('High-quality Markdown to PDF converter CLI with Mermaid, Math, and ASCII UI mockup support.')
  .version(packageJson.version, '-v, --version', 'Output tool version')
  .argument('<input>', 'Input Markdown file path (.md)')
  .argument('[output]', 'Output PDF file path (.pdf)')
  .option('-o, --output <path>', 'Output PDF file path (.pdf)')
  .option('-t, --theme <theme>', 'Theme name: modern (default), dark, academic, minimal', 'modern')
  .option('-p, --page-size <size>', 'Paper size: A4, Letter, A3, Legal', 'A4')
  .option('-l, --landscape', 'Use landscape orientation', false)
  .option('-m, --margin <margin>', 'Page margin (e.g. 14mm 12mm 16mm 12mm)', '14mm 12mm 16mm 12mm')
  .option('-k, --keep-html', 'Keep temporary HTML file after conversion', false)
  .option('--no-mermaid', 'Disable Mermaid diagram rendering')
  .option('--no-katex', 'Disable KaTeX math formula rendering')
  .option('-b, --browser <path>', 'Custom Chrome/Edge executable path')
  .action(async (inputArg, outputArg, options) => {
    try {
      const targetOutput = options.output || outputArg;
      const startTime = Date.now();

      console.log(`\x1b[36m🚀 Converting Markdown to PDF...\x1b[0m`);
      console.log(`   Input:  ${path.resolve(inputArg)}`);
      console.log(`   Theme:  ${options.theme}`);
      console.log(`   Paper:  ${options.pageSize} (${options.landscape ? 'Landscape' : 'Portrait'})`);

      const result = await convertMarkdownToPdf(inputArg, targetOutput, {
        theme: options.theme,
        pageSize: options.pageSize,
        orientation: options.landscape ? 'landscape' : 'portrait',
        margin: options.margin,
        keepHtml: options.keepHtml,
        mermaid: options.mermaid,
        katex: options.katex,
        executablePath: options.browser
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\x1b[32m✔ Success!\x1b[0m PDF generated in ${duration}s:`);
      console.log(`   \x1b[33m${result.pdfPath}\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m✖ Error:\x1b[0m ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
