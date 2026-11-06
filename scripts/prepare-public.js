const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../apps/mobile/dist');
const destDir = path.resolve(__dirname, '../public');

if (fs.existsSync(srcDir)) {
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('[Build] Copied apps/mobile/dist to root public/ for Vercel static serving.');
} else {
  console.warn('[Build] Warning: apps/mobile/dist not found.');
}
