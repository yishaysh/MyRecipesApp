const fs = require('fs');
const path = require('path');

/**
 * Reads canonical app version and Android build number from apps/mobile/app.json.
 */
function getAppVersionLabel() {
  const appJsonPath = path.resolve(__dirname, '../apps/mobile/app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const version = (appJson && appJson.expo && appJson.expo.version) || '1.0.0';
  const buildNumber =
    (appJson && appJson.expo && appJson.expo.android && appJson.expo.android.versionCode) ||
    (appJson && appJson.expo && appJson.expo.ios && appJson.expo.ios.buildNumber) ||
    1;
  return `v${version} (Build ${buildNumber})`;
}

/**
 * Stamps the canonical mobile app version label into web client HTML.
 */
function applyWebVersionLabel(html) {
  if (!html || typeof html !== 'string') return '';
  const versionLabel = getAppVersionLabel();
  return html
    .replace(/\{\{APP_VERSION_LABEL\}\}/g, versionLabel)
    .replace(/v\d+\.\d+\.\d+\s*\(Build\s*\d+\)/g, versionLabel);
}

module.exports = {
  getAppVersionLabel,
  applyWebVersionLabel,
};

