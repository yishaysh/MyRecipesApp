process.env.NODE_ENV = 'test';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');
const ADMIN_HTML_PATH = path.join(REPO_ROOT, 'public', 'admin.html');
const PANTRY_UI_JS_PATH = path.join(REPO_ROOT, 'public', 'pantry-search-ui.js');

describe('v2.3.7 (Build 56) Groups Search, Compact Sticky Header, 2-Column Grid & Pantry Back-to-Group Suite', () => {
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
  const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');
  const pantryUiJs = fs.readFileSync(PANTRY_UI_JS_PATH, 'utf8');

  test('1. Search in Groups Overview & Group Detail', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Search in Groups Overview & Group Detail | ${new Date().toISOString()}`);

    assert.ok(
      appHtml.includes('matchesLibrarySearchQuery('),
      'public/app.html must define shared matchesLibrarySearchQuery('
    );
    console.log('[ASSERT]: Shared matchesLibrarySearchQuery( helper found in public/app.html');

    const handleSearchIdx = appHtml.indexOf('function handleLibrarySearch(');
    const clearSearchIdx = appHtml.indexOf('function clearLibrarySearch(');
    assert.ok(handleSearchIdx !== -1, 'public/app.html must define handleLibrarySearch(');
    assert.ok(clearSearchIdx !== -1, 'public/app.html must define clearLibrarySearch(');

    const handleSearchSlice = appHtml.slice(handleSearchIdx, handleSearchIdx + 800);
    const clearSearchSlice = appHtml.slice(clearSearchIdx, clearSearchIdx + 800);
    assert.ok(
      handleSearchSlice.includes('renderCollectionsView()'),
      'handleLibrarySearch( must call renderCollectionsView()'
    );
    assert.ok(
      clearSearchSlice.includes('renderCollectionsView()'),
      'clearLibrarySearch( must call renderCollectionsView()'
    );
    console.log('[ASSERT]: Both handleLibrarySearch( and clearLibrarySearch( trigger renderCollectionsView()');

    assert.ok(
      appHtml.includes('collections-search-results-grid'),
      'public/app.html must render collections-search-results-grid on groups overview search'
    );
    assert.ok(
      appHtml.includes('recipe-group-chip'),
      'public/app.html must render recipe-group-chip on groups overview search results'
    );
    assert.ok(
      appHtml.includes('לא נמצאו מתכונים בקבוצה'),
      'public/app.html must render empty-state text "לא נמצאו מתכונים בקבוצה" inside open group detail'
    );
    console.log('[ASSERT]: Groups overview search grid, group chips, and group detail empty state verified');

    const sigMatches: number[] = [];
    let searchPos = 0;
    while (true) {
      const idx = appHtml.indexOf('lastCollectionsGridSignature', searchPos);
      if (idx === -1) break;
      sigMatches.push(idx);
      searchPos = idx + 1;
    }
    assert.ok(sigMatches.length > 0, 'public/app.html must track lastCollectionsGridSignature');
    const hasSearchQueryInSig = sigMatches.some((idx) =>
      appHtml.slice(Math.max(0, idx - 400), idx + 600).includes('searchQuery')
    );
    assert.ok(hasSearchQueryInSig, 'lastCollectionsGridSignature computation must include searchQuery');
    console.log('[ASSERT]: lastCollectionsGridSignature includes searchQuery');

    console.log(`[TEST END]: Search in Groups Overview & Group Detail PASSED (${Date.now() - t0}ms)`);
  });

  test('2. Compact Sticky Group Header & 2-Column Recipe Grid', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Compact Sticky Group Header & 2-Column Recipe Grid | ${new Date().toISOString()}`);

    const headerCssMatches: string[] = [];
    let headerPos = 0;
    while (true) {
      const idx = appHtml.indexOf('.collection-detail-header', headerPos);
      if (idx === -1) break;
      headerCssMatches.push(appHtml.slice(idx, idx + 700));
      headerPos = idx + 1;
    }
    assert.ok(headerCssMatches.length > 0, 'public/app.html must define .collection-detail-header styles');
    assert.ok(
      headerCssMatches.some((slice) => slice.includes('max-height: 48px')),
      '.collection-detail-header must enforce compact max-height: 48px'
    );
    assert.ok(
      headerCssMatches.some((slice) => slice.includes('position: sticky')),
      '.collection-detail-header must use position: sticky'
    );
    console.log('[ASSERT]: Compact sticky .collection-detail-header (max-height: 48px, position: sticky) verified');

    assert.ok(
      appHtml.includes('collection-detail-menu-btn') && appHtml.includes('⋯'),
      'public/app.html must include #collection-detail-menu-btn with overflow icon "⋯"'
    );
    assert.ok(
      appHtml.includes('renameUserCollection') && appHtml.includes('deleteUserCollection'),
      'public/app.html must wire renameUserCollection and deleteUserCollection actions'
    );
    assert.ok(
      appHtml.includes('syncLibraryTopControlsVisibility()'),
      'public/app.html must include syncLibraryTopControlsVisibility()'
    );
    console.log('[ASSERT]: Overflow menu (#collection-detail-menu-btn), rename/delete actions, and top controls visibility sync verified');

    const gridCssMatches: string[] = [];
    let gridPos = 0;
    while (true) {
      const idx = appHtml.indexOf('.group-recipes-grid', gridPos);
      if (idx === -1) break;
      gridCssMatches.push(appHtml.slice(idx, idx + 500));
      gridPos = idx + 1;
    }
    assert.ok(gridCssMatches.length > 0, 'public/app.html must define .group-recipes-grid');
    assert.ok(
      gridCssMatches.some((slice) => slice.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')),
      '.group-recipes-grid must use grid-template-columns: repeat(2, minmax(0, 1fr))'
    );
    assert.ok(
      appHtml.includes('openAssignCollectionsModal('),
      'public/app.html must include openAssignCollectionsModal('
    );
    console.log('[ASSERT]: 2-column .group-recipes-grid and openAssignCollectionsModal( verified');

    console.log(`[TEST END]: Compact Sticky Group Header & 2-Column Recipe Grid PASSED (${Date.now() - t0}ms)`);
  });

  test('3. Pantry Search Back-to-Group & Bottom Nav Clearance', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Pantry Search Back-to-Group & Bottom Nav Clearance | ${new Date().toISOString()}`);

    assert.ok(
      appHtml.includes('pantryReturnCollection'),
      'public/app.html must track pantryReturnCollection so Back returns to the exact open group'
    );
    console.log('[ASSERT]: pantryReturnCollection state tracking verified in public/app.html');

    assert.ok(
      pantryUiJs.includes('padding-bottom: calc(96px'),
      'public/pantry-search-ui.js must include padding-bottom: calc(96px for bottom nav clearance'
    );
    console.log('[ASSERT]: padding-bottom: calc(96px verified in public/pantry-search-ui.js');

    console.log(`[TEST END]: Pantry Search Back-to-Group & Bottom Nav Clearance PASSED (${Date.now() - t0}ms)`);
  });

  test('4. Version v2.3.7 (Build 56) across web surfaces', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Version v2.3.7 (Build 56) Across Web Surfaces | ${new Date().toISOString()}`);

    assert.ok(appHtml.includes('v2.3.7 (Build 56)'), 'public/app.html must contain v2.3.7 (Build 56)');
    assert.ok(swJs.includes('v2.3.7 (Build 56)'), 'public/sw.js must contain v2.3.7 (Build 56)');
    assert.ok(adminHtml.includes('v2.3.7 (Build 56)'), 'public/admin.html must contain v2.3.7 (Build 56)');
    console.log('[ASSERT]: v2.3.7 (Build 56) verified in public/app.html, public/sw.js, and public/admin.html');

    console.log(`[TEST END]: Version v2.3.7 (Build 56) Across Web Surfaces PASSED (${Date.now() - t0}ms)`);
  });
});
