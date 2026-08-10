# 🔒 Privacy Policy for Markdown to PDF Converter

**Last Updated**: August 11, 2026

## Overview
**Markdown to PDF Converter** ("the Extension") is committed to protecting user privacy. This extension operates **100% locally** inside your Google Chrome browser.

## Data Collection & Storage
- **No Personal Data Collection**: The Extension does **not** collect, transmit, store, or sell any personal data, browsing history, IP addresses, or document contents to external servers or third parties.
- **Local Storage Usage**: The Extension utilizes Chrome's `chrome.storage.sync` and `chrome.storage.local` API solely to store user UI preferences (such as selected theme, paper size, and diagram toggles) and temporary document contents for rendering the local print preview page. All data stays strictly on your device.
- **No Third-Party Analytics**: The Extension does not include any third-party tracking scripts, analytics, telemetries, or advertisements.

## Permissions Usage
- `activeTab`: Used strictly to read Markdown text from the current active tab when requested by the user via the popup or context menu.
- `storage`: Used to persist user preference settings (theme, paper size, toggles) locally.
- `contextMenus`: Used to add context menu options when right-clicking highlighted Markdown text.
- `scripting`: Used to extract raw Markdown text from web pages for conversion upon user request.

## Contact & Open Source
This extension is open-source under the MIT License. You can review the complete source code on GitHub:  
[https://github.com/vannt-dev/convert-md-to-pdf](https://github.com/vannt-dev/convert-md-to-pdf)
