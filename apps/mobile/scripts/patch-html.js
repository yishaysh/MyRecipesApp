const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../dist/index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  const tags = `
    <!-- iOS Safari Fullscreen PWA & Home Screen Icon -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ספר המתכונים" />
    <meta name="theme-color" content="#064e3b" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
  </head>`;

  html = html.replace('</head>', tags);
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('[PWA] Injected iOS PWA meta tags into dist/index.html');
}
