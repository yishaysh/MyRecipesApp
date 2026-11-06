const fs = require('fs');
const path = require('path');

const destDir = path.resolve(__dirname, '../public');
const appDistDir = path.resolve(__dirname, '../apps/mobile/dist');

// 1. Ensure public directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 2. If mobile dist exists, copy static assets (icons, etc.)
if (fs.existsSync(appDistDir)) {
  fs.cpSync(appDistDir, destDir, { recursive: true });
}

// 3. Ensure getWebClientHtml is written as the primary index.html and app.html
try {
  const { getWebClientHtml } = require('../services/api/dist/views/web-client.html.js');
  const webClientHtml = getWebClientHtml();
  fs.writeFileSync(path.join(destDir, 'index.html'), webClientHtml, 'utf8');
  fs.writeFileSync(path.join(destDir, 'app.html'), webClientHtml, 'utf8');

  const appSubDir = path.join(destDir, 'app');
  if (!fs.existsSync(appSubDir)) {
    fs.mkdirSync(appSubDir, { recursive: true });
  }
  fs.writeFileSync(path.join(appSubDir, 'index.html'), webClientHtml, 'utf8');

  console.log('[Build] Successfully generated static web client at public/index.html, public/app.html, and public/app/index.html');
} catch (err) {
  console.error('[Build] Failed to generate static web client HTML:', err);
}
