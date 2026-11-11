const fs = require('fs');
const path = require('path');
const { applyWebVersionLabel } = require('./web-version-sync');

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
  const webClientHtml = applyWebVersionLabel(getWebClientHtml());
  fs.writeFileSync(path.join(destDir, 'index.html'), webClientHtml, 'utf8');
  fs.writeFileSync(path.join(destDir, 'app.html'), webClientHtml, 'utf8');

  const appSubDir = path.join(destDir, 'app');
  if (!fs.existsSync(appSubDir)) {
    fs.mkdirSync(appSubDir, { recursive: true });
  }
  fs.writeFileSync(path.join(appSubDir, 'index.html'), webClientHtml, 'utf8');

  // 4. Generate secret admin dashboard at public/admin.html
  const { getAdminDashboardHtml } = require('../services/api/dist/views/admin.html.js');
  const adminHtml = getAdminDashboardHtml();
  fs.writeFileSync(path.join(destDir, 'admin.html'), adminHtml, 'utf8');

  const adminSubDir = path.join(destDir, 'admin');
  if (!fs.existsSync(adminSubDir)) {
    fs.mkdirSync(adminSubDir, { recursive: true });
  }
  fs.writeFileSync(path.join(adminSubDir, 'index.html'), adminHtml, 'utf8');

  console.log('[Build] Successfully generated static web client & secret admin portal');
} catch (err) {
  console.error('[Build] Failed to generate static web client HTML:', err);
}
