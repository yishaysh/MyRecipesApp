#!/usr/bin/env node
/**
 * Build-time JavaScript syntax gate for inline <script> blocks in built HTML files
 * and standalone web JS assets. Runs `node --check` on every extracted inline script
 * and exits non-zero if any script fails to parse.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function extractInlineScripts(html) {
  const scripts = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    // Skip external scripts and non-JS data blocks (e.g. application/ld+json)
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const scriptType = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
    if (scriptType && !['text/javascript', 'application/javascript', 'module'].includes(scriptType)) {
      continue;
    }
    if (!body.trim()) continue;
    index++;
    const lineOffset = html.slice(0, match.index).split(/\r?\n/).length;
    scripts.push({
      index,
      isModule: scriptType === 'module',
      lineOffset,
      code: body
    });
  }
  return scripts;
}

function checkJsSource(code, label, isModule) {
  const ext = isModule ? '.mjs' : '.js';
  const tmpFile = path.join(
    os.tmpdir(),
    `myrecipes-syntax-check-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  );
  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
    execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
  } catch (err) {
    const stderr = err && err.stderr ? err.stderr.toString('utf8') : String(err);
    throw new Error(`Syntax check FAILED for ${label}:\n${stderr}`);
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (_e) {}
  }
}

function checkHtmlFile(filePath) {
  const absPath = path.resolve(filePath);
  const relPath = path.relative(REPO_ROOT, absPath) || absPath;
  if (!fs.existsSync(absPath)) {
    throw new Error(`Syntax check FAILED: required file not found: ${relPath}`);
  }
  const html = fs.readFileSync(absPath, 'utf8');
  const scripts = extractInlineScripts(html);
  if (scripts.length === 0) {
    throw new Error(`Syntax check FAILED: no inline <script> blocks found in ${relPath}`);
  }
  for (const sc of scripts) {
    checkJsSource(sc.code, `${relPath} (inline script #${sc.index}, starts at HTML line ${sc.lineOffset})`, sc.isModule);
  }
  return scripts.length;
}

function runSyntaxGate(customTargets) {
  const htmlTargets = customTargets && customTargets.length > 0
    ? customTargets
    : [
        path.join(REPO_ROOT, 'public', 'app.html'),
        path.join(REPO_ROOT, 'public', 'admin.html')
      ];

  let totalScripts = 0;
  for (const target of htmlTargets) {
    const count = checkHtmlFile(target);
    totalScripts += count;
    console.log(`[SyntaxGate] PASS: ${path.relative(REPO_ROOT, target)} (${count} inline script block${count === 1 ? '' : 's'})`);
  }

  // Also check standalone web JS assets (service worker + Welcome Guide ESM) when running default build gate
  if (!customTargets || customTargets.length === 0) {
    const swPath = path.join(REPO_ROOT, 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      checkJsSource(fs.readFileSync(swPath, 'utf8'), 'public/sw.js', false);
      console.log('[SyntaxGate] PASS: public/sw.js');
    }
    const welcomeGuidePath = path.join(REPO_ROOT, 'public', 'welcome-guide.js');
    if (fs.existsSync(welcomeGuidePath)) {
      checkJsSource(fs.readFileSync(welcomeGuidePath, 'utf8'), 'public/welcome-guide.js', true);
      console.log('[SyntaxGate] PASS: public/welcome-guide.js (ESM)');
    }
    const pantryEnginePath = path.join(REPO_ROOT, 'public', 'pantry-search-engine.js');
    if (fs.existsSync(pantryEnginePath)) {
      checkJsSource(fs.readFileSync(pantryEnginePath, 'utf8'), 'public/pantry-search-engine.js', true);
      console.log('[SyntaxGate] PASS: public/pantry-search-engine.js (ESM)');
    }
    const pantryUiPath = path.join(REPO_ROOT, 'public', 'pantry-search-ui.js');
    if (fs.existsSync(pantryUiPath)) {
      checkJsSource(fs.readFileSync(pantryUiPath, 'utf8'), 'public/pantry-search-ui.js', true);
      console.log('[SyntaxGate] PASS: public/pantry-search-ui.js (ESM)');
    }
  }
  return totalScripts;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    runSyntaxGate(args.length > 0 ? args : null);
  } catch (err) {
    console.error(`[SyntaxGate] ${err.message}`);
    process.exit(1);
  }
}

module.exports = { extractInlineScripts, checkHtmlFile, runSyntaxGate };
