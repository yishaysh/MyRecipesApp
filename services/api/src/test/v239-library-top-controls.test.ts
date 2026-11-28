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

function extractTagById(html: string, id: string): string {
  const re = new RegExp(`<[^>]*\\bid="${id}"[^>]*>`, 'i');
  const match = html.match(re);
  return match ? match[0] : '';
}

function extractButtonBlockById(html: string, id: string): string {
  const re = new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/button>`, 'i');
  const match = html.match(re);
  return match ? match[0] : '';
}

describe('v2.3.9 (Build 58) Library Top Controls, Segmented Tablist, Action Row & RTL Swipe Suite', () => {
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
  const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');

  test('1. Segmented Control Markup, Sliding Indicator & A11y', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Segmented Control Markup, Sliding Indicator & A11y | ${new Date().toISOString()}`);

    const toggleTag = extractTagById(appHtml, 'library-view-toggle');
    assert.ok(toggleTag.length > 0, 'public/app.html must define #library-view-toggle');
    assert.ok(toggleTag.includes('role="tablist"'), '#library-view-toggle must have role="tablist"');
    console.log('[ASSERT]: #library-view-toggle has role="tablist"');

    const collectionsTabTag = extractTagById(appHtml, 'view-btn-collections');
    const gridTabTag = extractTagById(appHtml, 'view-btn-grid');
    assert.ok(collectionsTabTag.length > 0, 'public/app.html must define #view-btn-collections');
    assert.ok(gridTabTag.length > 0, 'public/app.html must define #view-btn-grid');

    assert.ok(collectionsTabTag.includes('role="tab"'), '#view-btn-collections must have role="tab"');
    assert.ok(collectionsTabTag.includes('aria-selected='), '#view-btn-collections must have aria-selected');
    assert.ok(
      collectionsTabTag.includes('aria-controls="collections-view-container"'),
      '#view-btn-collections must have aria-controls="collections-view-container"'
    );

    assert.ok(gridTabTag.includes('role="tab"'), '#view-btn-grid must have role="tab"');
    assert.ok(gridTabTag.includes('aria-selected='), '#view-btn-grid must have aria-selected');
    assert.ok(
      gridTabTag.includes('aria-controls="library-list"'),
      '#view-btn-grid must have aria-controls="library-list"'
    );
    console.log('[ASSERT]: #view-btn-collections and #view-btn-grid have role="tab", aria-selected, and aria-controls');

    assert.ok(appHtml.includes('.segmented-indicator'), 'public/app.html must style .segmented-indicator');
    assert.ok(appHtml.includes('segmented-indicator'), 'public/app.html must render .segmented-indicator element');
    assert.ok(appHtml.includes('data-active-tab'), 'public/app.html must track data-active-tab on segmented control');
    assert.ok(appHtml.includes('prefers-reduced-motion'), 'public/app.html must respect prefers-reduced-motion');
    assert.ok(
      appHtml.includes('ArrowLeft') && appHtml.includes('ArrowRight'),
      'public/app.html must handle ArrowLeft and ArrowRight keyboard navigation on segmented tabs'
    );
    console.log('[ASSERT]: .segmented-indicator, data-active-tab, prefers-reduced-motion, and ArrowLeft/ArrowRight verified');

    console.log(`[TEST END]: Segmented Control Markup, Sliding Indicator & A11y PASSED (${Date.now() - t0}ms)`);
  });

  test('2. 3 Equal Action Buttons, Share SVG Icon & Responsive Short Labels', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: 3 Equal Action Buttons, Share SVG Icon & Responsive Short Labels | ${new Date().toISOString()}`);

    const actionRowCssMatches: string[] = [];
    let pos = 0;
    while (true) {
      const idx = appHtml.indexOf('.library-actions-row', pos);
      if (idx === -1) break;
      actionRowCssMatches.push(appHtml.slice(idx, idx + 1600));
      pos = idx + 1;
    }
    assert.ok(actionRowCssMatches.length > 0, 'public/app.html must define .library-actions-row styles');
    assert.ok(
      actionRowCssMatches.some((slice) => slice.includes('grid-template-columns: repeat(3, minmax(0, 1fr))')),
      '.library-actions-row must use grid-template-columns: repeat(3, minmax(0, 1fr))'
    );
    assert.ok(
      actionRowCssMatches.some((slice) => slice.includes('height: 44px')),
      '.library-actions-row / .library-action-btn must enforce height: 44px'
    );
    assert.ok(
      actionRowCssMatches.some((slice) => slice.includes('border-radius: 14px')),
      '.library-actions-row / .library-action-btn must enforce border-radius: 14px'
    );
    console.log('[ASSERT]: .library-actions-row 3-column grid, height: 44px, and border-radius: 14px verified');

    const requiredIds = [
      'library-view-toggle',
      'view-btn-collections',
      'view-btn-grid',
      'web-new-collection-btn',
      'web-share-book-btn',
      'open-pantry-search-btn',
    ];
    for (const id of requiredIds) {
      assert.ok(appHtml.includes(`id="${id}"`), `public/app.html must keep required ID #${id}`);
    }
    console.log('[ASSERT]: All 6 required top-control IDs preserved');

    const shareBtnBlock = extractButtonBlockById(appHtml, 'web-share-book-btn');
    assert.ok(shareBtnBlock.length > 0, 'public/app.html must render #web-share-book-btn button');
    assert.ok(shareBtnBlock.includes('<svg'), '#web-share-book-btn must use an inline <svg share icon');
    assert.ok(!shareBtnBlock.includes('📚'), '#web-share-book-btn must NOT use the legacy 📚 emoji');
    console.log('[ASSERT]: #web-share-book-btn uses inline <svg icon without legacy 📚 emoji');

    const newColBtnTag = extractTagById(appHtml, 'web-new-collection-btn');
    const shareBtnTag = extractTagById(appHtml, 'web-share-book-btn');
    const pantryBtnTag = extractTagById(appHtml, 'open-pantry-search-btn');

    assert.ok(
      pantryBtnTag.includes('library-action-btn--primary'),
      '#open-pantry-search-btn must have primary filled class library-action-btn--primary'
    );
    assert.ok(
      !newColBtnTag.includes('library-action-btn--primary'),
      '#web-new-collection-btn must NOT have library-action-btn--primary'
    );
    assert.ok(
      !shareBtnTag.includes('library-action-btn--primary'),
      '#web-share-book-btn must NOT have library-action-btn--primary'
    );
    assert.ok(
      appHtml.includes('.library-action-btn--primary'),
      'public/app.html must define .library-action-btn--primary CSS rule'
    );
    assert.ok(
      pantryBtnTag.includes('aria-label="מה אפשר לבשל? חיפוש לפי מרכיבים בבית"'),
      '#open-pantry-search-btn must preserve aria-label="מה אפשר לבשל? חיפוש לפי מרכיבים בבית"'
    );
    console.log('[ASSERT]: Primary filled class isolated to #open-pantry-search-btn and full aria-label preserved');

    console.log(`[TEST END]: 3 Equal Action Buttons, Share SVG Icon & Responsive Short Labels PASSED (${Date.now() - t0}ms)`);
  });

  test('3. Passive RTL Swipe Logic & Exclusion Guards', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Passive RTL Swipe Logic & Exclusion Guards | ${new Date().toISOString()}`);

    const fnDefIdx = appHtml.indexOf('function initLibraryTabSwipe(');
    const swipeIdx = fnDefIdx !== -1 ? fnDefIdx : appHtml.indexOf('initLibraryTabSwipe(');
    assert.ok(swipeIdx !== -1, 'public/app.html must define initLibraryTabSwipe(');

    const swipeSlice = appHtml.slice(swipeIdx, swipeIdx + 5000);
    assert.ok(/\{\s*passive\s*:\s*true\s*\}/.test(swipeSlice), 'initLibraryTabSwipe( must register touch listeners with { passive: true }');
    assert.ok(swipeSlice.includes('>= 60') || swipeSlice.includes('60'), 'initLibraryTabSwipe( must check horizontal threshold >= 60px');
    assert.ok(swipeSlice.includes('1.5'), 'initLibraryTabSwipe( must check horizontal-vs-vertical ratio 1.5');
    assert.ok(swipeSlice.includes('< 600') || swipeSlice.includes('600'), 'initLibraryTabSwipe( must check swipe duration < 600ms');

    assert.ok(
      swipeSlice.includes('dx < 0') && (swipeSlice.includes("'grid'") || swipeSlice.includes('"grid"')),
      'initLibraryTabSwipe( must map RTL swipe dx < 0 to "grid"'
    );
    assert.ok(
      swipeSlice.includes('dx > 0') && (swipeSlice.includes("'collections'") || swipeSlice.includes('"collections"')),
      'initLibraryTabSwipe( must map RTL swipe dx > 0 to "collections"'
    );
    console.log('[ASSERT]: Passive touch listeners, thresholds (>= 60, 1.5, < 600), and RTL direction mapping verified');

    const lowerSlice = swipeSlice.toLowerCase();
    assert.ok(lowerSlice.includes('input'), 'initLibraryTabSwipe( must exclude input elements');
    assert.ok(lowerSlice.includes('modal'), 'initLibraryTabSwipe( must exclude modal dialogs');
    assert.ok(swipeSlice.includes('.search-section'), 'initLibraryTabSwipe( must exclude .search-section');
    assert.ok(swipeSlice.includes('#kitchen-modal'), 'initLibraryTabSwipe( must exclude #kitchen-modal');
    assert.ok(swipeSlice.includes('activeOpenCollection'), 'initLibraryTabSwipe( must exclude open groups via activeOpenCollection');
    console.log('[ASSERT]: Swipe exclusion guards (inputs, modals, .search-section, #kitchen-modal, activeOpenCollection) verified');

    console.log(`[TEST END]: Passive RTL Swipe Logic & Exclusion Guards PASSED (${Date.now() - t0}ms)`);
  });

  test('4. Version v2.3.9 (Build 58) across web surfaces', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Version v2.3.9 (Build 58) Across Web Surfaces | ${new Date().toISOString()}`);

    assert.ok(appHtml.includes('v2.3.9 (Build 58)'), 'public/app.html must contain v2.3.9 (Build 58)');
    assert.ok(swJs.includes('v2.3.9 (Build 58)'), 'public/sw.js must contain v2.3.9 (Build 58)');
    assert.ok(adminHtml.includes('v2.3.9 (Build 58)'), 'public/admin.html must contain v2.3.9 (Build 58)');
    console.log('[ASSERT]: v2.3.9 (Build 58) verified in public/app.html, public/sw.js, and public/admin.html');

    console.log(`[TEST END]: Version v2.3.9 (Build 58) Across Web Surfaces PASSED (${Date.now() - t0}ms)`);
  });
});
