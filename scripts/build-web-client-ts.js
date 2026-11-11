const fs = require('fs');
const path = require('path');
const { applyWebVersionLabel, getAppVersionLabel } = require('./web-version-sync');

const appHtmlPath = path.resolve(__dirname, '../public/app.html');
const rawAppHtml = fs.readFileSync(appHtmlPath, 'utf8');
const appHtml = applyWebVersionLabel(rawAppHtml);

if (appHtml !== rawAppHtml) {
  fs.writeFileSync(appHtmlPath, appHtml, 'utf8');
}

const targetTsPath = path.resolve(__dirname, '../services/api/src/views/web-client.html.ts');
const tsContent = `// Auto-generated 1:1 mobile-matching web client\nexport function getWebClientHtml(): string {\n  return ${JSON.stringify(appHtml)};\n}\n`;

fs.writeFileSync(targetTsPath, tsContent, 'utf8');

// Also sync public/index.html and public/app/index.html
const indexHtmlPath = path.resolve(__dirname, '../public/index.html');
fs.writeFileSync(indexHtmlPath, appHtml, 'utf8');

const appSubDir = path.resolve(__dirname, '../public/app');
if (!fs.existsSync(appSubDir)) {
  fs.mkdirSync(appSubDir, { recursive: true });
}
fs.writeFileSync(path.join(appSubDir, 'index.html'), appHtml, 'utf8');

console.log(`Successfully synced public/app.html (${getAppVersionLabel()}) -> web-client.html.ts, public/index.html, and public/app/index.html`);

