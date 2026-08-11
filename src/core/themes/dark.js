/**
 * Dark Theme Styles
 */
module.exports = `
  body { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 10px; }
  h1 { font-size: 21px; color: #f8fafc; border-bottom: 3px solid #38bdf8; padding-bottom: 8px; break-after: avoid-page; }
  h2 { font-size: 16px; color: #38bdf8; background: #1e293b; border-left: 5px solid #38bdf8; padding: 6px 12px; border-radius: 0 4px 4px 0; break-after: avoid-page; }
  h3 { font-size: 14.5px; color: #7dd3fc; border-bottom: 1px solid #334155; padding-bottom: 4px; break-after: avoid-page; }
  blockquote { background: #1e293b; border-left: 4px solid #38bdf8; color: #cbd5e1; padding: 10px 16px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  tr { break-inside: avoid-page; }
  th { background: #1e293b; color: #38bdf8; padding: 8px; border: 1px solid #334155; }
  td { padding: 7px; border: 1px solid #334155; }
  tbody tr:nth-child(even) { background: #1e293b; }
  code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: #1e293b; color: #f8fafc; padding: 2px 6px; border-radius: 3px; border: 1px solid #334155; }
  pre { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; background: #020617; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
  .formula-box { background: #1e293b; border: 1px solid #38bdf8; padding: 10px 16px; border-radius: 4px; text-align: center; color: #38bdf8; }
  .mermaid-container { display: block; text-align: center; margin: 14px 0; background: #1e293b; padding: 12px; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
  .mermaid { display: block; text-align: center; width: 100%; }
  .mermaid svg { max-width: 100% !important; height: auto !important; margin: 0 auto; display: inline-block; }
`;
