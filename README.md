# 📄 convert-md-to-pdf

> A powerful CLI tool and **Browser Extension (Manifest V3)** to convert Markdown (`.md`) files, raw text, or web pages into beautifully styled, high-quality PDF & static HTML documents. Built with support for **Cover Pages**, **Dotted Leader Line Table of Contents (TOC)**, **Mermaid.js diagrams**, **LaTeX Math**, **GitHub Callout Alerts**, **Custom CSS Injection**, **7 Preset Themes**, and **Open-Source Font Selection**.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install_Extension-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/markdown-to-pdf-converter/djikikejkmkklfeklfmddaadilhahamj)
![npm version](https://img.shields.io/npm/v/convert-md-to-pdf?color=blue)
![Browser Extension](https://img.shields.io/badge/Extension-Manifest_V3-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🧩 **Browser Extension (Manifest V3)**:
  - Drag & drop single or **multiple `.md` files** directly into the popup.
  - Auto-saved draft text in popup & conversion history list with 1-click re-open.
  - Convert active web page or GitHub raw Markdown files with 1 click.
  - Context menu integration: Right-click selected Markdown text or any page -> "Convert to PDF".
  - Full-page Print Preview with live theme switching, Font Selector, Auto TOC, Custom CSS, and native PDF/HTML export.
- 📑 **Auto Cover Page Generator**: Generate elegant document report cover pages via YAML Front Matter (`cover: true`) or `--cover` flag.
- 📌 **Dotted Leader Line Table of Contents (TOC)**: Auto-generates publication-grade TOC with dotted leader lines (`...`) and clickable anchor links (`--toc`).
- 🎨 **7 Preset Themes**: `modern` (default), `dark`, `academic`, `github`, `ebook`, `cyberpunk`, and `minimal`.
- 🔤 **Open-Source Font Selector**: 100% free under SIL OFL / Apache 2.0 (`Inter`, `Roboto`, `Lora`, `Merriweather`, `JetBrains Mono`, `Fira Code`).
- ⚡ **Live Watch Mode & HTML Export**: Real-time auto-recompilation on file changes (`-w, --watch`) and direct static HTML export (`-f, --format html`).
- 🚀 **CLI & Batch Conversion**: Convert single files or batch process directories with wildcard patterns.
- 🎨 **Custom CSS Injection**: Inject custom branding CSS stylesheets (`-c, --css custom.css`).
- 📊 **Mermaid Diagrams**: Sequence diagrams (with auto note wrapping), flowcharts, class diagrams, and gantt charts.
- 📐 **LaTeX Math Support**: Mathematical equations rendered with KaTeX.
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
```bash
npm install -g convert-md-to-pdf
```
or run directly with `npx`:
```bash
npx convert-md-to-pdf input.md
```

### CLI Examples:
```bash
# Convert a Markdown file with Cover Page, Auto TOC & Cyberpunk Theme
npx convert-md-to-pdf input.md --cover --toc -t cyberpunk --font "Fira Code" -o output.pdf

# Watch file and auto-recompile on save
npx convert-md-to-pdf input.md -w -f html

# Batch convert multiple files to an output directory
npx convert-md-to-pdf file1.md file2.md -o output_dir/

# Convert entire directory of .md files
npx convert-md-to-pdf ./docs/ -o ./dist/
```

---

## 🛠️ CLI Options

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `-o, --output <path>`| | Output PDF/HTML file path or target directory | Auto-derived |
| `-f, --format <format>`| | Output format: `pdf`, `html` | `pdf` |
| `-w, --watch` | | Live watch input file and auto-recompile on change | `false` |
| `-t, --theme <theme>` | | Theme: `modern`, `dark`, `academic`, `github`, `ebook`, `cyberpunk`, `minimal` | `modern` |
| `--font <font>` | | Font family: `Inter`, `Roboto`, `Lora`, `Merriweather`, `JetBrains Mono`, `Fira Code` | `Inter` |
| `--cover` | | Auto-generate document report Cover Page | `false` |
| `--toc` | | Auto-generate Table of Contents with Dotted Leader Lines | `false` |
| `-p, --page-size <size>`| | Paper size: `A4`, `Letter`, `A3`, `Legal` | `A4` |
| `-l, --landscape` | | Use landscape page orientation | `false` |
| `-m, --margin <margin>`| | Custom page margin (e.g. `14mm 12mm 16mm 12mm`) | `14mm 12mm 16mm 12mm` |
| `-c, --css <path>` | | Custom CSS stylesheet file path to inject | |
| `-k, --keep-html` | | Keep temporary HTML file after conversion | `false` |
| `--no-mermaid` | | Disable Mermaid diagram rendering | `false` |
| `--no-katex` | | Disable KaTeX math formula rendering | `false` |

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
---
# Document Executive Summary
...
```

---

## 🌿 Git Workflow & Contribution

Please review our [Git Commit & Push Workflow Guide (GIT_WORKFLOW.md)](GIT_WORKFLOW.md) for conventional commit guidelines, branching strategies, and pre-commit checks.

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
│   │   ├── cover.js         # Cover page generator
│   │   ├── toc.js           # Dotted leader line TOC generator
│   │   ├── sanitizer.js     # HTML sanitizer & escaping
│   │   ├── utils.js         # Preprocessors & helper re-exports
│   │   ├── parser.js        # Pipeline parser (Markdown -> HTML)
│   │   ├── templates.js     # HTML document template builder
│   │   └── index.js         # Main library API entrypoint
│   └── browser/             # Headless browser rendering engine
│       └── renderer.js      # Puppeteer Chrome/Edge launcher & PDF worker pool
├── extension/               # Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/          # Service worker & context menus
│   ├── content/             # Content script for raw MD pages
│   ├── popup/               # Extension Popup UI (Batch file, Paste, Page, History)
│   ├── preview/             # Print Preview & PDF/HTML export page
│   ├── lib/                 # Vendor libraries (marked, mermaid, katex)
│   └── icons/               # Extension icons (16, 48, 128)
├── tests/                   # Standalone test suite (7/7 PASS)
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
