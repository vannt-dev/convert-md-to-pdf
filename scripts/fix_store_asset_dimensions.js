const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const storeDir = path.join(__dirname, '..', 'store-assets');

const psScript = `
Add-Type -AssemblyName System.Drawing

function Resize-Exact($inputPath, $outputPath, $targetWidth, $targetHeight, $isPng) {
    if (-not (Test-Path $inputPath)) { return }
    
    # Load into memory stream to prevent file locking
    $bytes = [System.IO.File]::ReadAllBytes($inputPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $src = [System.Drawing.Image]::FromStream($ms)

    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($src, 0, 0, $targetWidth, $targetHeight)
    
    $src.Dispose()
    $ms.Dispose()
    $g.Dispose()

    if ($isPng) {
        $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
        $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    
    $bmp.Dispose()
}

$storeDir = '${storeDir.replace(/\\/g, '\\\\')}'

# Generate PNG versions
Resize-Exact (Join-Path $storeDir 'store_icon_128x128.jpg') (Join-Path $storeDir 'store_icon_128x128.png') 128 128 $true
Resize-Exact (Join-Path $storeDir 'promo_tile_440x280.jpg') (Join-Path $storeDir 'promo_tile_440x280.png') 440 280 $true
Resize-Exact (Join-Path $storeDir 'screenshot_1_popup.jpg') (Join-Path $storeDir 'screenshot_1_popup.png') 1280 800 $true
Resize-Exact (Join-Path $storeDir 'screenshot_2_preview.jpg') (Join-Path $storeDir 'screenshot_2_preview.png') 1280 800 $true

# Overwrite JPG versions
Resize-Exact (Join-Path $storeDir 'store_icon_128x128.jpg') (Join-Path $storeDir 'store_icon_128x128.jpg') 128 128 $false
Resize-Exact (Join-Path $storeDir 'promo_tile_440x280.jpg') (Join-Path $storeDir 'promo_tile_440x280.jpg') 440 280 $false
Resize-Exact (Join-Path $storeDir 'screenshot_1_popup.jpg') (Join-Path $storeDir 'screenshot_1_popup.jpg') 1280 800 $false
Resize-Exact (Join-Path $storeDir 'screenshot_2_preview.jpg') (Join-Path $storeDir 'screenshot_2_preview.jpg') 1280 800 $false
`;

const psPath = path.join(__dirname, 'resize_store_assets.ps1');
fs.writeFileSync(psPath, psScript, 'utf8');

try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { stdio: 'inherit' });
  console.log('Successfully resized all store assets to exact Chrome Web Store dimensions!');
} finally {
  if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
}
