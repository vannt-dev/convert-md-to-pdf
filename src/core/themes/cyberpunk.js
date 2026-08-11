/**
 * Cyberpunk Theme Styles
 */
module.exports = `
  body { font-family: 'Fira Code', 'JetBrains Mono', monospace; font-size: 12.5px; line-height: 1.6; color: #00f0ff; background-color: #0d1117; padding: 10px; }
  h1 { font-size: 21px; color: #ff007f; text-shadow: 0 0 5px rgba(255,0,127,0.5); border-bottom: 2px solid #ff007f; padding-bottom: 6px; break-after: avoid-page; text-transform: uppercase; }
  h2 { font-size: 16px; color: #00f0ff; background: #161b22; border-left: 4px solid #00f0ff; padding: 6px 12px; break-after: avoid-page; }
  h3 { font-size: 14px; color: #ffe600; border-bottom: 1px solid #30363d; padding-bottom: 4px; break-after: avoid-page; }
  blockquote { background: #161b22; border-left: 4px solid #ff007f; color: #8b949e; padding: 10px 16px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11.5px; }
  tr { break-inside: avoid-page; }
  th { background: #161b22; color: #00f0ff; padding: 8px; border: 1px solid #30363d; }
  td { padding: 7px; border: 1px solid #30363d; color: #c9d1d9; }
  tbody tr:nth-child(even) { background: #161b22; }
  code { font-family: 'Fira Code', monospace; font-size: 11px; background: #161b22; color: #ff007f; padding: 2px 6px; border: 1px solid #30363d; }
  pre { font-family: 'Fira Code', monospace; font-size: 10px; background: #010409; color: #00f0ff; padding: 12px; border-radius: 4px; border: 1px solid #30363d; overflow-x: auto; break-inside: avoid-page; }
  .formula-box { background: #161b22; border: 1px solid #00f0ff; padding: 10px; text-align: center; color: #00f0ff; }
  .mermaid-container { display: block; text-align: center; margin: 14px 0; background: #161b22; padding: 10px; border: 1px solid #ff007f; border-radius: 4px; overflow-x: auto; break-inside: avoid-page; }
  .mermaid { display: block; text-align: center; width: 100%; }
  .mermaid svg { max-width: 100% !important; height: auto !important; margin: 0 auto; display: inline-block; }
`;
