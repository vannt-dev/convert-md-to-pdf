/**
 * Modern Theme Styles
 */
module.exports = `
  body { font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.55; color: #1e293b; background-color: #ffffff; margin: 0; padding: 10px; }
  h1 { font-size: 21px; font-weight: 700; color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.3px; break-after: avoid-page; page-break-after: avoid; }
  h2 { font-size: 16px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border-left: 5px solid #2563eb; padding: 6px 12px; margin-top: 22px; margin-bottom: 12px; border-radius: 0 4px 4px 0; break-after: avoid-page; page-break-after: avoid; }
  h3 { font-size: 14.5px; font-weight: 600; color: #1e40af; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; break-after: avoid-page; page-break-after: avoid; }
  h4 { font-size: 13.5px; font-weight: 600; color: #334155; margin-top: 12px; margin-bottom: 6px; break-after: avoid-page; page-break-after: avoid; }
  .section-group { break-inside: avoid-page; page-break-inside: avoid; }
  .formula-box { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; padding: 10px 16px; border-radius: 4px; margin: 12px 0; font-size: 13.5px; color: #0369a1; text-align: center; }
  .formula-box span { font-weight: 500; background: #ffffff; padding: 2px 8px; border-radius: 3px; border: 1px solid #e0f2fe; }
  blockquote { margin: 12px 0; padding: 10px 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; color: #334155; font-size: 12.5px; }
  blockquote p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; break-inside: auto; }
  tr { break-inside: avoid-page; page-break-inside: avoid; }
  th { background-color: #1e293b; color: #ffffff; font-weight: 600; text-align: left; padding: 7px 9px; border: 1px solid #334155; font-size: 11.5px; letter-spacing: 0.2px; }
  td { padding: 6px 9px; border: 1px solid #cbd5e1; vertical-align: top; }
  tbody tr:nth-child(even) { background-color: #f8fafc; }
  code { font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-size: 11.5px; background-color: #f1f5f9; color: #0f172a; padding: 1px 5px; border-radius: 3px; border: 1px solid #e2e8f0; }
  pre { font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-size: 10.5px; line-height: 1.4; background-color: #0f172a; color: #f8fafc; padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 10px 0; white-space: pre-wrap; word-break: break-all; break-inside: avoid-page; page-break-inside: avoid; }
  pre code { background: none; color: inherit; padding: 0; border: none; font-size: inherit; }
  .ui-mockup-container { margin: 12px 0; break-inside: avoid-page; page-break-inside: avoid; }
  .ui-mockup { background-color: #1e1e2e; color: #a6adc8; border: 1px solid #313244; border-left: 4px solid #89b4fa; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  .ui-mockup code { color: #cdd6f4; }
  .mermaid-container { display: block; text-align: center; margin: 14px 0; background-color: #ffffff; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; page-break-inside: avoid; }
  .mermaid { display: block; text-align: center; width: 100%; }
  .mermaid svg { max-width: 100% !important; height: auto !important; margin: 0 auto; display: inline-block; }
  hr { border: 0; height: 1px; background: #e2e8f0; margin: 16px 0; }
  ul, ol { padding-left: 20px; margin: 6px 0; }
  li { margin-bottom: 3px; }
  strong { color: #0f172a; }
  a { color: #2563eb; text-decoration: none; }
`;
