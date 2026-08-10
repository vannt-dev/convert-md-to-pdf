const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const brainDir = 'C:\\Users\\vance\\.gemini\\antigravity-cli\\brain\\bf451eda-6e37-48d1-b10b-f2783763b502';
const files = fs.readdirSync(brainDir);
const masterIcon = files.find(f => f.startsWith('new_extension_icon_') && f.endsWith('.jpg'));

if (!masterIcon) {
  console.error('Master icon file not found!');
  process.exit(1);
}

const masterPath = path.join(brainDir, masterIcon);
const destDir = path.join(__dirname, '..', 'chrome-extension', 'icons');
const storeDir = path.join(__dirname, '..', 'store-assets');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

// Copy master icon to store assets
fs.copyFileSync(masterPath, path.join(storeDir, 'store_icon_128x128.jpg'));

// PowerShell script to resize image to 16, 48, 128
const psScript = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${masterPath.replace(/\\/g, '\\\\')}')

function ResizeImg($img, $w, $h, $out) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

ResizeImg $src 16 16 '${path.join(destDir, 'icon16.png').replace(/\\/g, '\\\\')}'
ResizeImg $src 48 48 '${path.join(destDir, 'icon48.png').replace(/\\/g, '\\\\')}'
ResizeImg $src 128 128 '${path.join(destDir, 'icon128.png').replace(/\\/g, '\\\\')}'

$src.Dispose()
`;

const psPath = path.join(__dirname, 'resize.ps1');
fs.writeFileSync(psPath, psScript, 'utf8');

try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { stdio: 'inherit' });
  console.log('Successfully generated 16x16, 48x48, 128x128 icons!');
} finally {
  if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
}
