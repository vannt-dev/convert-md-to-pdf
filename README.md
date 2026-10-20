# 📄 convert-md-to-pdf

> A powerful CLI tool and **Browser Extension (Manifest V3)** to convert Markdown (`.md`) files, raw text, or web pages into beautifully styled, high-quality PDF & static HTML documents. Built with support for **Cover Pages**, **Dotted Leader Line Table of Contents (TOC)**, **Mermaid.js diagrams**, **LaTeX Math**, **GitHub Callout Alerts**, **Custom CSS Injection**, **7 Preset Themes**, and **Open-Source Font Selection**.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install_Extension-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/markdown-to-pdf-converter/djikikejkmkklfeklfmddaadilhahamj)
[![Chrome Web Store users](https://img.shields.io/chrome-web-store/users/djikikejkmkklfeklfmddaadilhahamj?label=Chrome%20users)](https://chromewebstore.google.com/detail/markdown-to-pdf-converter/djikikejkmkklfeklfmddaadilhahamj)
[![npm version](https://img.shields.io/npm/v/md-pdf-studio?color=blue)](https://www.npmjs.com/package/md-pdf-studio)
[![npm downloads](https://img.shields.io/npm/d18m/md-pdf-studio)](https://www.npmjs.com/package/md-pdf-studio)
![Browser Extension](https://img.shields.io/badge/Extension-Manifest_V3-green)
![License](https://img.shields.io/badge/license-MIT-green)
[![Official vannt-dev build](https://vannt-dev.github.io/badges/official.svg)](https://vannt-dev.github.io/official.html)

---

Official builds are listed at [vannt-dev.github.io/official.html](https://vannt-dev.github.io/official.html);
anything else is not published by vannt-dev.

## ✨ Features

- 🧩 **Browser Extension (Manifest V3)**:
  - Drag & drop single or **multiple `.md` files** directly into the popup.
  - Auto-saved draft text in popup & conversion history list with 1-click re-open.
  - Convert active web page or GitHub raw Markdown files with 1 click.
  - Context menu integration: Right-click selected Markdown text or any page -> "Convert to PDF".
  - Full-page Print Preview with live theme switching, Font Selector, Auto TOC, Custom CSS, and native PDF/HTML export.
  - Page numbers and a running header/footer, set in the popup (off by default).
- 📑 **Auto Cover Page Generator**: Generate elegant document report cover pages via YAML Front Matter (`cover: true`) or `--cover` flag.
- 🔢 **Page Numbers & Running Header/Footer**: `--page-numbers` prints "Page 3 of 12" at the foot of each page (`--page-numbers simple` prints "3"). `--header` and `--footer` print a line of text at the top and foot of each page, with `{title}`, `{author}`, `{date}`, `{page}` and `{pages}` filled in; `--header` alone prints the document title. With both a footer and page numbers, the footer text sits left and the numbers right. The cover page is printed without them, but counts as page 1. All off by default; front matter keys `header`, `footer` and `pageNumbers` do the same. PDF only (the CLI and the extension); Word and EPUB leave them out.
- 📌 **Dotted Leader Line Table of Contents (TOC)**: Auto-generates publication-grade TOC with dotted leader lines (`...`) and clickable anchor links (`--toc`).
- 🎨 **7 Preset Themes**: `modern` (default), `dark`, `academic`, `github`, `ebook`, `cyberpunk`, and `minimal`.
- 🔤 **Open-Source Font Selector**: 100% free under SIL OFL / Apache 2.0 (`Inter`, `Roboto`, `Lora`, `Merriweather`, `JetBrains Mono`, `Fira Code`).
- ⚡ **Live Watch Mode & HTML Export**: Real-time auto-recompilation on file changes (`-w, --watch`) and direct static HTML export (`-f, --format html`).
- 🚀 **CLI & Batch Conversion**: Convert single files or batch process directories with wildcard patterns.
- 🎨 **Custom CSS Injection**: Inject custom branding CSS stylesheets (`-c, --css custom.css`).
- 📊 **Mermaid Diagrams**: Sequence diagrams (with auto note wrapping), flowcharts, class diagrams, and gantt charts.
- 🌈 **Syntax Highlighting**: Fenced code blocks that name a language (` ```js `, ` ```python `, ` ```diff `, …) are coloured at build time with highlight.js — no CDN, so it also works offline and in static HTML export. Colours follow the theme's code block background. Works in the CLI and in the extension preview.
- 📐 **LaTeX Math Support**: Mathematical equations rendered with KaTeX.
- 📝 **Footnotes**: `text[^1]` with `[^1]: the note` anywhere in the file. Notes are numbered in the order they are first referenced, gathered at the end of the document, and linked both ways. Works in the CLI and in the extension preview.
- 📘 **Word & EPUB Export (CLI)**: `-f docx` writes a Word document and `-f epub` an EPUB 3 e-book, straight from the Markdown and without a browser. Headings, lists (nested, numbered from any start, task lists), tables with their alignment, code blocks, quotes, footnotes, links and local images become the real thing in each format — Word styles you can restyle, a chapter per top-level heading and a navigation menu in the EPUB. `--toc`, `--cover`, page size, orientation and margins apply to Word; `--toc` and `--cover` to EPUB. Themes, custom CSS, Mermaid diagrams and KaTeX math are for PDF and HTML only: a diagram or formula is kept as its source. An image on the web is not downloaded — it is named in Word and becomes a link in the EPUB — and a link to a neighbouring file keeps its text only.
- 🔖 **PDF Bookmarks (CLI)**: The PDF gets an outline (bookmarks) built from its headings, nested by level, so a PDF viewer's sidebar can jump to any section. On by default; `--no-outline` or `outline: false` in the front matter leaves it out. The extension prints through the browser's print dialog, which does not add bookmarks.
- 📎 **File Includes (CLI)**: A line that holds only `@import "chapters/intro.md"` is replaced by that file, relative to the file the line is in. A Markdown file is inserted as Markdown (without its front matter) and may import further files; any other file — `@import "src/app.js"` — is inserted as a code block labelled with its extension. Lines inside a code block are left alone, a missing file or files that import each other stop the conversion with the file and line, and watch mode follows the imported files. `--no-include` turns it off.
- 💡 **GitHub Callout Box Alerts**: Support for `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, and `> [!CAUTION]`.
- 💻 **ASCII UI Mockups**: Styled dark-theme boxes for terminal output & ASCII wireframe mockups.

---

## 🌐 Extension Installation & Usage

### 🛒 Direct Install from Chrome Web Store (Recommended)
You can install the official published extension directly with 1-click:
👉 **[Install Markdown to PDF Converter on Chrome Web Store](https://chromewebstore.google.com/detail/markdown-to-pdf-converter/djikikejkmkklfeklfmddaadilhahamj)**

### 🛠️ Developer Unpacked Installation (Local Build):
1. Clone or download this repository:
   ```bash
   git clone https://github.com/vannt-dev/convert-md-to-pdf.git
   ```
2. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (Tải tiện ích đã giải nén).
5. Select the **`extension`** directory inside this repository (or load `dist/extension-latest.zip`).
6. The **Markdown to PDF Converter** icon will appear in your browser toolbar!

---

## 💻 CLI Installation & Usage

### Global Installation via npm / npx
The CLI is published on npm as [`md-pdf-studio`](https://www.npmjs.com/package/md-pdf-studio):
```bash
npm install -g md-pdf-studio
```
or run directly with `npx`:
```bash
npx md-pdf-studio input.md
```
A global install provides the `md-pdf-studio` command and the `md2pdf` and `convert-md-to-pdf` aliases.
PDF output uses a locally installed Google Chrome, Microsoft Edge or Chromium.

> The npm package named `convert-md-to-pdf` is an unrelated project; install `md-pdf-studio` for this tool.

### CLI Examples:
```bash
# Convert a Markdown file with Cover Page, Auto TOC & Cyberpunk Theme
npx md-pdf-studio input.md --cover --toc -t cyberpunk --font "Fira Code" -o output.pdf

# Watch file and auto-recompile on save
npx md-pdf-studio input.md -w -f html

# Batch convert multiple files to an output directory
npx md-pdf-studio file1.md file2.md -o output_dir/

# Convert entire directory of .md files
npx md-pdf-studio ./docs/ -o ./dist/

# Word document with a cover page and a table of contents
npx md-pdf-studio report.md -f docx --cover --toc

# EPUB e-book, one chapter per top-level heading
npx md-pdf-studio book.md -f epub -o book.epub
```

A book kept as one file per chapter is one document with includes:

```markdown
---
title: Handbook
toc: true
---
# Handbook

@import "chapters/01-intro.md"
@import "chapters/02-setup.md"

## Example config

@import "examples/config.yml"
```

---

## 🛠️ CLI Options

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `-o, --output <path>`| | Output file path or target directory | Auto-derived |
| `-f, --format <format>`| | Output format: `pdf`, `html`, `docx`, `epub` | `pdf` |
| `-w, --watch` | | Live watch input file and auto-recompile on change | `false` |
| `-t, --theme <theme>` | | Theme: `modern`, `dark`, `academic`, `github`, `ebook`, `cyberpunk`, `minimal` | `modern` |
| `--font <font>` | | Font family: `Inter`, `Roboto`, `Lora`, `Merriweather`, `JetBrains Mono`, `Fira Code` | `Inter` |
| `--cover` | | Auto-generate document report Cover Page | `false` |
| `--toc` | | Auto-generate Table of Contents with Dotted Leader Lines | `false` |
| `--page-numbers [style]` | | Page numbers at the foot of each page: `full` ("Page 3 of 12") or `simple` ("3") | off (`full` when given alone) |
| `--header [text]` | | Running header; `{title}`, `{author}`, `{date}`, `{page}`, `{pages}` are filled in | off (the title when given alone) |
| `--footer [text]` | | Running footer, same placeholders | off ("Page {page} of {pages}" when given alone) |
| `-p, --page-size <size>`| | Paper size: `A4`, `Letter`, `A3`, `Legal` | `A4` |
| `-l, --landscape` | | Use landscape page orientation | `false` |
| `-m, --margin <margin>`| | Custom page margin (e.g. `14mm 12mm 16mm 12mm`) | `14mm 12mm 16mm 12mm` |
| `-c, --css <path>` | | Custom CSS stylesheet file path to inject | |
| `-k, --keep-html` | | Keep temporary HTML file after conversion | `false` |
| `--no-mermaid` | | Disable Mermaid diagram rendering | `false` |
| `--no-katex` | | Disable KaTeX math formula rendering | `false` |
| `--no-highlight` | | Disable syntax highlighting of code blocks | `false` |
| `--no-include` | | Leave `@import "file"` lines as they are instead of inserting the file | `false` |
| `--no-outline` | | Leave out the PDF bookmarks (outline) made from the headings | `false` |

---

## 📄 Front Matter Options

You can specify conversion settings directly inside your `.md` files using YAML Front Matter:

```yaml
---
title: "Quarterly Financial Report"
subtitle: "Q3 Fiscal Summary"
author: "Engineering Team"
date: "2026-08-11"
cover: true
toc: true
theme: github
font: Inter
pageSize: A4
landscape: false
highlight: true
# running header and footer; header: true also means the title
header: "{title}"
footer: "Engineering Team"
# full ("Page 3 of 12"), simple ("3") or false
pageNumbers: full
---
# Document Executive Summary
...
```

---

## 🌿 Branching & Automated Release Workflow

### 🔀 Branching Strategy
- **`main`**: The default branch. Changes arrive through pull requests from short-lived feature branches, and pushing a version tag `v*` from `main` triggers a release.

### 🚀 Automated Release Pipeline
Whenever a version tag `v*` is pushed, GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) builds from that tag and automatically:
1. Checks that the tag matches the version in `package.json` and `extension/manifest.json`, then runs the full unit test suite (`npm test`).
2. Bundles cross-platform extension zip artifacts (`dist/extension-vX.Y.Z.zip`).
3. Auto-generates release notes from commit history.
4. Publishes a new official **[GitHub Release](https://github.com/vannt-dev/convert-md-to-pdf/releases)** with downloadable ZIP binaries attached!
5. Publishes [`md-pdf-studio`](https://www.npmjs.com/package/md-pdf-studio) to npm with provenance, through npm trusted publishing (no token secret). A version already on npm is skipped.

To release an existing tag again (for example after a failed run), run the workflow manually with `tag_name`.

### 💡 1-Click CLI Release Command
You can also bump version and trigger a release with a single CLI command:
```bash
npm run release <version|patch|minor|major>
# Example: npm run release 1.2.0
```

Please review our [Git Commit & Push Workflow Guide (GIT_WORKFLOW.md)](GIT_WORKFLOW.md) for conventional commit guidelines and pre-commit checks.

---

## 📁 Project Architecture

```
convert-md-to-pdf/
├── bin/
│   └── cli.js               # CLI executable with watch & format options
├── src/
│   ├── core/                # Shared modular conversion engine
│   │   ├── themes/          # Modular Theme CSS collection
│   │   │   ├── index.js     # Theme registry & font override builder
│   │   │   ├── cover.js     # Cover page CSS
│   │   │   ├── modern.js    # Modern blue theme
│   │   │   ├── dark.js      # Dark slate theme
│   │   │   ├── academic.js  # Academic serif theme
│   │   │   ├── github.js    # GitHub light theme
│   │   │   ├── ebook.js     # E-Book paper theme
│   │   │   ├── cyberpunk.js # Cyberpunk neon dark theme
│   │   │   └── minimal.js   # Minimal monochrome theme
│   │   ├── frontmatter.js   # YAML front matter parser
│   │   ├── include.js       # @import "file" expansion
│   │   ├── docmodel.js      # Format-neutral document model (blocks of flat runs)
│   │   ├── docx.js          # Word (.docx) writer
│   │   ├── epub.js          # EPUB 3 writer
│   │   ├── images.js        # Local image reading & sizes
│   │   ├── zip.js           # ZIP container writer for docx/epub
│   │   ├── cover.js         # Cover page generator
│   │   ├── toc.js           # Dotted leader line TOC generator
│   │   ├── sanitizer.js     # HTML sanitizer & escaping
│   │   ├── utils.js         # Preprocessors & helper re-exports
│   │   ├── parser.js        # Pipeline parser (Markdown -> HTML)
│   │   ├── templates.js     # HTML document template builder
│   │   ├── pagemarks.js     # Page numbers & running header/footer CSS (shared with the extension)
│   │   └── index.js         # Main library API entrypoint
│   └── browser/             # Headless browser rendering engine
│       └── renderer.js      # Runs installed Chrome/Edge headless (--print-to-pdf) & PDF worker pool
├── extension/               # Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/          # Service worker & context menus
│   ├── content/             # Content script for raw MD pages
│   ├── popup/               # Extension Popup UI (Batch file, Paste, Page, History)
│   ├── preview/             # Print Preview & PDF/HTML export page
│   ├── lib/                 # Vendor libraries (marked, mermaid, katex) & code shared with the CLI
│   └── icons/               # Extension icons (16, 48, 128)
├── tests/                   # Standalone test suite (`npm test`)
│   └── index.test.js
├── dist/                    # Built Chrome Extension zip artifacts
├── examples/                # Usage examples & custom CSS templates
├── package.json
├── README.md
├── PRIVACY_POLICY.md
└── GIT_WORKFLOW.md
```

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
