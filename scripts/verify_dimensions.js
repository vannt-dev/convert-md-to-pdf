const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const storeDir = path.join(__dirname, '..', 'store-assets');

const psScript = `
Add-Type -AssemblyName System.Drawing
Get-ChildItem "${storeDir.replace(/\\/g, '\\\\')}" | ForEach-Object {
    if ($_.Extension -match '\\.(jpg|png)$') {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
        Write-Output "$($_.Name) -> $($img.Width) x $($img.Height) px"
        $img.Dispose()
    }
}
`;

const psPath = path.join(__dirname, 'check_dims.ps1');
fs.writeFileSync(psPath, psScript, 'utf8');

try {
  const output = execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { encoding: 'utf8' });
  console.log(output);
} finally {
  if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
}
