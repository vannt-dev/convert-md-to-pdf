/**
 * Minimal Theme Styles
 */
module.exports = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: #000000; background-color: #ffffff; padding: 10px; }
  h1 { font-size: 20px; font-weight: 700; border-bottom: 2px solid #000; padding-bottom: 4px; break-after: avoid-page; }
  h2 { font-size: 15px; font-weight: 700; margin-top: 18px; break-after: avoid-page; }
  h3 { font-size: 13.5px; font-weight: 600; break-after: avoid-page; }
  blockquote { border-left: 3px solid #000; padding-left: 12px; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  tr { break-inside: avoid-page; }
  th, td { border: 1px solid #000; padding: 6px; }
  th { background: #f2f2f2; font-weight: 700; }
  code { font-family: monospace; font-size: 11px; background: #f2f2f2; padding: 2px 4px; }
  pre { font-family: monospace; font-size: 10.5px; background: #f9f9f9; border: 1px solid #ccc; padding: 10px; break-inside: avoid-page; }
  .formula-box { border: 1px solid #000; padding: 8px; text-align: center; margin: 10px 0; }
  .mermaid-container { display: block; text-align: center; margin: 12px 0; border: 1px solid #ccc; padding: 8px; overflow-x: auto; break-inside: avoid-page; }
  .mermaid { display: block; text-align: center; width: 100%; }
  .mermaid svg { max-width: 100% !important; height: auto !important; margin: 0 auto; display: inline-block; }
`;
