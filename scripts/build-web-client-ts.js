const fs = require('fs');
const path = require('path');

const appHtmlPath = path.resolve(__dirname, '../public/app.html');
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');

const targetTsPath = path.resolve(__dirname, '../services/api/src/views/web-client.html.ts');
const tsContent = `// Auto-generated 1:1 mobile-matching web client\nexport function getWebClientHtml(): string {\n  return ${JSON.stringify(appHtml)};\n}\n`;

fs.writeFileSync(targetTsPath, tsContent, 'utf8');

// Also sync public/index.html
const indexHtmlPath = path.resolve(__dirname, '../public/index.html');
fs.writeFileSync(indexHtmlPath, appHtml, 'utf8');

console.log('Successfully synced public/app.html -> web-client.html.ts and public/index.html');

