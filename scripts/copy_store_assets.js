const fs = require('fs');
const path = require('path');

const storeDir = path.join(__dirname, '..', 'store-assets');
if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
}

const brainDir = 'C:\\Users\\vance\\.gemini\\antigravity-cli\\brain\\bf451eda-6e37-48d1-b10b-f2783763b502';
const files = fs.readdirSync(brainDir);

const iconFile = files.find(f => f.startsWith('store_icon_design_') && f.endsWith('.jpg'));
const promoFile = files.find(f => f.startsWith('store_promo_banner_') && f.endsWith('.jpg'));
const popupFile = files.find(f => f.startsWith('store_screenshot_popup_') && f.endsWith('.jpg'));
const previewFile = files.find(f => f.startsWith('store_screenshot_preview_') && f.endsWith('.jpg'));

if (iconFile) fs.copyFileSync(path.join(brainDir, iconFile), path.join(storeDir, 'store_icon_128x128.jpg'));
if (promoFile) fs.copyFileSync(path.join(brainDir, promoFile), path.join(storeDir, 'promo_tile_440x280.jpg'));
if (popupFile) fs.copyFileSync(path.join(brainDir, popupFile), path.join(storeDir, 'screenshot_1_popup.jpg'));
if (previewFile) fs.copyFileSync(path.join(brainDir, previewFile), path.join(storeDir, 'screenshot_2_preview.jpg'));

console.log('Store assets copied successfully:');
console.log(fs.readdirSync(storeDir));
