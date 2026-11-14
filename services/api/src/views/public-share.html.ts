import {
  DEFAULT_REFERRAL_DISCLOSURE_TEXT,
  ShareLinkRecord,
  ShareSnapshotRecord,
} from '../services/growth-store.service.js';

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForInlineScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderRevokedShareHtml(options?: { notFound?: boolean; baseUrl?: string }): string {
  const isNotFound = Boolean(options?.notFound);
  const title = isNotFound ? 'הקישור לא נמצא' : 'הקישור בוטל';
  const subtitle = isNotFound
    ? 'קישור השיתוף שביקשת אינו קיים או שפג תוקפו.'
    : 'בעל השיתוף ביטל את הקישור או שהמתכון הוסר. תצוגות מקדימות או עותקים שכבר נשמרו אצל אחרים אינם ניתנים למחיקה.';
  const baseUrl = (options?.baseUrl || '').replace(/\/$/, '');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
  <title>${escapeHtml(title)} - ספר המתכונים שלי</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)} - ספר המתכונים שלי" />
  <meta property="og:description" content="קישור זה אינו זמין יותר לצפייה." />
  <meta property="og:image" content="${escapeHtml(baseUrl)}/icon-512.png" />
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 20px;
      direction: rtl;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .icon { font-size: 42px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 10px; color: #0f172a; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
    .btn {
      display: inline-block;
      background: #059669;
      color: #fff;
      text-decoration: none;
      padding: 12px 22px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <a class="btn" href="/app">מעבר לספר המתכונים שלי</a>
  </div>
</body>
</html>`;
}

export function renderPublicShareHtml(params: {
  share: ShareLinkRecord;
  snapshot: ShareSnapshotRecord;
  rawToken: string;
  baseUrl?: string;
}): string {
  const { share, snapshot, rawToken } = params;
  const baseUrl = (params.baseUrl || '').replace(/\/$/, '');
  const recipes = snapshot.payload.recipes || [];
  const firstRecipe = recipes[0];
  const isBook = share.type === 'book';
  const pageTitle = isBook
    ? snapshot.payload.bookTitle || `ספר מתכונים משותף (${recipes.length} מתכונים)`
    : firstRecipe?.title || 'מתכון משותף';

  // Privacy-safe OG tags by default unless the owner explicitly enabled detailed previews
  const ogTitle = share.ogConsent
    ? pageTitle
    : isBook
      ? 'ספר מתכונים משותף ב-ספר המתכונים שלי'
      : 'מתכון משותף ב-ספר המתכונים שלי';
  const ogDesc = share.ogConsent
    ? isBook
      ? `${recipes.length} מתכונים שנשמרו לשיתוף — פתחו ושמרו לספר האישי בחינם.`
      : firstRecipe?.description || 'צפו במרכיבים ובשלבי ההכנה ושמרו לספר האישי שלכם בחינם.'
    : 'לחצו לצפייה במתכון המשותף ושמירה לספר האישי בחינם.';
  const ogImage =
    share.ogConsent && firstRecipe?.id
      ? `${baseUrl}/api/public/shares/${encodeURIComponent(rawToken)}/image?recipeId=${encodeURIComponent(firstRecipe.id)}`
      : `${baseUrl}/icon-512.png`;

  const clientPayload = {
    shareId: share.id,
    token: rawToken,
    type: share.type,
    snapshotVersion: snapshot.snapshotVersion,
    bookTitle: snapshot.payload.bookTitle || null,
    sharerDisplayName: snapshot.payload.sharerDisplayName || null,
    defaultDisclosureText: DEFAULT_REFERRAL_DISCLOSURE_TEXT,
    recipes: recipes.map((r) => ({
      ...r,
      imageUrl: r.imageUrl
        ? `/api/public/shares/${encodeURIComponent(rawToken)}/image?recipeId=${encodeURIComponent(r.id)}`
        : null,
    })),
  };

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
  <title>${escapeHtml(pageTitle)} - ספר המתכונים שלי</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDesc)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      direction: rtl;
      padding-bottom: 96px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(255,255,255,0.94);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .brand { font-weight: 800; font-size: 15px; color: #065f46; display: flex; align-items: center; gap: 6px; }
    .container { max-width: 720px; margin: 0 auto; padding: 16px; }
    .notice-bar {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .card {
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
      overflow: hidden;
      margin-bottom: 16px;
    }
    .hero-img {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      display: block;
      background: #e2e8f0;
    }
    .card-body { padding: 18px; }
    h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.3; }
    h2 { margin: 18px 0 10px; font-size: 17px; color: #0f172a; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #475569; margin-bottom: 12px; }
    .pill { background: #f1f5f9; border-radius: 999px; padding: 4px 10px; font-weight: 600; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .btn {
      border: none;
      border-radius: 12px;
      padding: 11px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-primary { background: #059669; color: #fff; }
    .btn-secondary { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .btn-outline { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
    .btn-danger-text { background: transparent; color: #64748b; font-size: 12px; padding: 6px 10px; }
    .ing-list, .step-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .ing-item {
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 10px;
      font-size: 14px;
      border: 1px solid #f1f5f9;
    }
    .step-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
      display: flex;
      gap: 10px;
      font-size: 14px;
      line-height: 1.55;
    }
    .step-num {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      background: #059669;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }
    .search-box {
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      font-size: 14px;
      margin-bottom: 14px;
      background: #fff;
    }
    .book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .book-card {
      background: #fff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      flex-direction: column;
    }
    .book-card img { width: 100%; height: 130px; object-fit: cover; background: #e2e8f0; }
    .book-card-body { padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
      z-index: 50; display: none; align-items: flex-end; justify-content: center;
    }
    .modal-backdrop.open { display: flex; }
    .modal-sheet {
      width: 100%; max-width: 600px; max-height: 88vh; overflow-y: auto;
      background: #fff; border-radius: 20px 20px 0 0; padding: 20px;
    }
    .banner-inapp {
      background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
      border-radius: 12px; padding: 12px; font-size: 13px; margin-top: 12px; display: none;
    }
    .disclosure {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 8px 12px; font-size: 12px; color: #475569; margin: 10px 0;
    }
    .toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 999px;
      font-size: 13px; font-weight: 600; z-index: 80; display: none;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">📖 ספר המתכונים שלי <span style="font-size:11px;font-weight:500;color:#64748b">(קריאה בלבד)</span></div>
    <a href="/app" style="font-size:13px;font-weight:700;color:#059669;text-decoration:none">פתיחת האפליקציה</a>
  </div>

  <div class="container">
    <div class="notice-bar">
      <span>
        ${share.type === 'book' ? `📚 גרסה שמורה מס׳ ${snapshot.snapshotVersion} • ${recipes.length} מתכונים` : '📄 מתכון משותף לקריאה חופשית'}
        ${share.sharerDisplayName ? ` • שותף ע"י ${escapeHtml(share.sharerDisplayName)}` : ''}
      </span>
      <button class="btn btn-danger-text" onclick="openReportModal()">🚩 דיווח על תוכן</button>
    </div>

    <div id="inapp-warning" class="banner-inapp"></div>
    <div id="main-content"></div>
  </div>

  <!-- Ingredient Basket Modal -->
  <div id="basket-modal" class="modal-backdrop" onclick="if(event.target===this) closeBasketModal()">
    <div class="modal-sheet">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="margin:0;">🛍️ רשימת מצרכים לקנייה</h2>
        <button class="btn btn-outline" style="padding:6px 10px;" onclick="closeBasketModal()">סגירה</button>
      </div>
      <div id="basket-body"></div>
    </div>
  </div>

  <!-- Duplicate / Save Notice Modal -->
  <div id="save-modal" class="modal-backdrop" onclick="if(event.target===this) closeSaveModal()">
    <div class="modal-sheet">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="margin:0;">📥 שמירה לספר המתכונים שלי</h2>
        <button class="btn btn-outline" style="padding:6px 10px;" onclick="closeSaveModal()">סגירה</button>
      </div>
      <div id="save-modal-body"></div>
    </div>
  </div>

  <!-- Report Modal -->
  <div id="report-modal" class="modal-backdrop" onclick="if(event.target===this) closeReportModal()">
    <div class="modal-sheet">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="margin:0;">🚩 דיווח על תוכן</h2>
        <button class="btn btn-outline" style="padding:6px 10px;" onclick="closeReportModal()">סגירה</button>
      </div>
      <p style="font-size:13px;color:#475569;margin-top:0;">נתקלת בתוכן פוגעני, הפרת זכויות יוצרים או קישור לא תקין? דווח/י לצוות האתר:</p>
      <select id="report-reason" class="search-box" style="margin-bottom:10px;">
        <option value="copyright">הפרת זכויות יוצרים</option>
        <option value="inappropriate">תוכן לא הולם / פוגעני</option>
        <option value="spam">ספאם או קישור שגוי</option>
        <option value="other">אחר</option>
      </select>
      <textarea id="report-details" class="search-box" rows="3" placeholder="פרטים נוספים (אופציונלי)"></textarea>
      <button class="btn btn-primary" style="width:100%;" onclick="submitReport()">שליחת דיווח</button>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const SHARE_DATA = ${safeJsonForInlineScript(clientPayload)};
    let activeRecipeIndex = 0;
    let basketMultiplier = 1;
    let basketHaveAtHome = {};
    let basketRemovedIds = {};
    let cachedMerchantsPayload = null;
    let selectedMerchantId = null;

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
    }

    function trackPublicEvent(eventName, metadata) {
      try {
        fetch('/api/public/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName,
            shareId: SHARE_DATA.shareId,
            snapshotVersion: SHARE_DATA.snapshotVersion,
            metadata: metadata || {}
          })
        }).catch(() => {});
      } catch {}
    }

    function isInAppBrowser() {
      const ua = navigator.userAgent || '';
      return /WhatsApp|Instagram|FBAN|FBAV|Telegram/i.test(ua);
    }

    function normalizeSearchName(rawName) {
      const stripWords = new Set(['גרם','גר','ג','ק"ג','קילו','מ"ל','ליטר','כוס','כוסות','כף','כפות','כפית','כפיות','יחידה','יחידות','קורט','חבילה','שן','שיניים','גדול','גדולים','גדולה','קטן','קטנים','קטנה','בינוני','טרי','טריים','טרייה','קצוץ','קצוצים','קצוצה','מגורד','מגורר','כתוש','פרוס','טחון','מומס','קפוא','לא חובה','אופציונלי','להגשה','לקישוט']);
      let c = String(rawName || '').replace(/\\([^)]*\\)/g,' ').replace(/לפי הטעם|לא חובה/g,' ').replace(/^[\\d.,/½¼¾\\-\\s]+/,' ');
      return c.split(/\\s+/).map(t => t.replace(/^[,.:;!?]+|[,.:;!?]+$/g,'')).filter(t => t && !/^[\\d.,/½¼¾\\-]+$/.test(t) && !stripWords.has(t.toLowerCase())).join(' ').trim() || String(rawName || '').trim();
    }

    function computeBasket(recipes, mult) {
      const map = {};
      (recipes || []).forEach(r => {
        (r.ingredients || []).forEach(ing => {
          if (!ing || !ing.name) return;
          const sq = normalizeSearchName(ing.name);
          const key = sq.toLowerCase();
          if (!map[key]) map[key] = { id: key, searchQuery: sq, displayName: sq, parts: {}, lines: [] };
          const toTaste = ing.qtyMode === 'to_taste' || String(ing.amount || '') === 'לפי הטעם';
          const num = toTaste ? null : (typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount || '').replace(',', '.')));
          const unit = String(ing.unit || '').trim();
          const line = toTaste ? (ing.name + ' (לפי הטעם)') : (Number.isFinite(num) && num > 0 ? [Math.round(num * mult * 100) / 100, unit, ing.name].filter(Boolean).join(' ') : [unit, ing.name].filter(Boolean).join(' '));
          if (line && !map[key].lines.includes(line)) map[key].lines.push(line);
          if (toTaste) {
            map[key].parts['__taste__'] = { toTaste: true };
          } else if (Number.isFinite(num) && num > 0) {
            const uk = 'u:' + unit.toLowerCase();
            if (!map[key].parts[uk]) map[key].parts[uk] = { amount: 0, unit };
            map[key].parts[uk].amount += num * mult;
          } else if (unit) {
            map[key].parts['raw:' + unit] = { amount: null, unit };
          }
        });
      });
      return Object.values(map).map(entry => {
        const qtyStr = Object.values(entry.parts).map(p => {
          if (p.toTaste) return 'לפי הטעם';
          if (p.amount !== null && p.amount !== undefined) {
            const rounded = Math.round(p.amount * 100) / 100;
            return p.unit ? (rounded + ' ' + p.unit) : String(rounded);
          }
          return p.unit || '';
        }).filter(Boolean).join(' + ');
        return { id: entry.id, searchQuery: entry.searchQuery, displayName: entry.displayName, displayQuantity: qtyStr, originalLines: entry.lines };
      });
    }

    function renderRecipeDetail(recipe, showBackBtn) {
      const ings = (recipe.ingredients || []).map(ing => {
        const toTaste = ing.qtyMode === 'to_taste' || String(ing.amount || '') === 'לפי הטעם';
        const txt = toTaste
          ? esc(ing.name) + ' <span style="color:#64748b">(לפי הטעם)</span>'
          : esc([ing.amount, ing.unit, ing.name].filter(Boolean).join(' '));
        return '<li class="ing-item">' + txt + '</li>';
      }).join('');

      const steps = (recipe.instructions || []).map((st, idx) =>
        '<li class="step-item"><div class="step-num">' + (st.stepNumber || idx + 1) + '</div><div>' + esc(st.instruction) + '</div></li>'
      ).join('');

      function isSafeShareHttpUrl(u) {
        try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; }
      }

      const attribution = recipe.sourceUrl && isSafeShareHttpUrl(recipe.sourceUrl)
        ? '<a href="' + esc(recipe.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:none;">🔗 מקור המתכון המקורי</a>'
        : '';

      setTimeout(() => trackPublicEvent('ingredients_cta_viewed', { recipeId: recipe.id }), 150);

      return \`
        \${showBackBtn ? '<button class="btn btn-outline" style="margin-bottom:12px;" onclick="renderBookOverview()">← חזרה לכל המתכונים בספר</button>' : ''}
        <div class="card">
          \${recipe.imageUrl ? '<img class="hero-img" src="' + esc(recipe.imageUrl) + '" alt="' + esc(recipe.title) + '" />' : ''}
          <div class="card-body">
            <h1>\${esc(recipe.title)}</h1>
            <div class="meta">
              <span class="pill">\${esc(recipe.category || 'כללי')}</span>
              \${recipe.servings ? '<span class="pill">🍽️ ' + recipe.servings + ' מנות</span>' : ''}
              \${recipe.totalTimeMinutes ? '<span class="pill">⏱️ ' + recipe.totalTimeMinutes + ' דק׳</span>' : ''}
              \${attribution}
            </div>
            \${recipe.description ? '<p style="font-size:14px;color:#475569;line-height:1.6;">' + esc(recipe.description) + '</p>' : ''}
            <div class="cta-row">
              <button class="btn btn-primary" data-save-recipe-idx="\${SHARE_DATA.recipes.indexOf(recipe)}">📥 שמירה לספר שלי</button>
              <button class="btn btn-secondary" onclick="openBasketModal([\${SHARE_DATA.recipes.indexOf(recipe)}])">🛍️ קניית המצרכים</button>
            </div>
            <h2>מצרכים (\${(recipe.ingredients || []).length})</h2>
            <ul class="ing-list">\${ings}</ul>
            <h2>שלבי הכנה (\${(recipe.instructions || []).length})</h2>
            <ol class="step-list">\${steps}</ol>
          </div>
        </div>\`;
    }

    function renderBookOverview(filterText) {
      const q = String(filterText || '').trim().toLowerCase();
      const filtered = SHARE_DATA.recipes.filter(r =>
        !q || (r.title || '').toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q)
      );

      const cards = filtered.map(r => {
        const idx = SHARE_DATA.recipes.indexOf(r);
        return \`
          <div class="book-card" onclick="openSingleFromBook(\${idx})">
            \${r.imageUrl ? '<img src="' + esc(r.imageUrl) + '" alt="' + esc(r.title) + '" />' : ''}
            <div class="book-card-body">
              <div style="font-weight:700;font-size:15px;">\${esc(r.title)}</div>
              <div style="font-size:12px;color:#64748b;">\${esc(r.category || 'כללי')} • \${(r.ingredients || []).length} מצרכים</div>
            </div>
          </div>\`;
      }).join('');

      document.getElementById('main-content').innerHTML = \`
        <div class="card">
          <div class="card-body">
            <h1>\${esc(SHARE_DATA.bookTitle || 'ספר מתכונים משותף')}</h1>
            <p style="font-size:14px;color:#475569;margin-top:4px;">\${SHARE_DATA.recipes.length} מתכונים בגרסה המשותפת. תמיד בחינם לקריאה ולשמירה.</p>
            <div class="cta-row">
              <button class="btn btn-primary" data-save-all="1">📥 שמירת הספר אצלי</button>
              <button class="btn btn-secondary" onclick="openBasketModal(SHARE_DATA.recipes.map((_,i)=>i))">🛍️ קניית כל המצרכים</button>
            </div>
          </div>
        </div>
        <input class="search-box" id="book-search-input" type="search" placeholder="🔍 חיפוש מתכון בתוך הספר המשותף..." value="\${esc(filterText || '')}" oninput="renderBookOverview(this.value)" />
        <div class="book-grid">\${cards || '<div style="color:#64748b;padding:20px;">לא נמצאו מתכונים התואמים לחיפוש</div>'}</div>\`;

      const inp = document.getElementById('book-search-input');
      if (inp && filterText) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }

    function openSingleFromBook(idx) {
      activeRecipeIndex = idx;
      document.getElementById('main-content').innerHTML = renderRecipeDetail(SHARE_DATA.recipes[idx], true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function getRegisteredAuthToken() {
      try {
        const tok = localStorage.getItem('my_recipes_token');
        if (!tok) return null;
        const userRaw = localStorage.getItem('my_recipes_user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          if (u && ((u.userId && (String(u.userId).startsWith('guest_') || String(u.userId).startsWith('anon_'))) || (u.email && String(u.email).endsWith('@guest.myrecipes.app')))) {
            return null;
          }
        }
        return tok;
      } catch (_e) {
        return null;
      }
    }

    async function handleSaveClick(recipeIds, label, forceDuplicate) {
      trackPublicEvent('save_cta_clicked', { recipeIds });
      const authToken = getRegisteredAuthToken();
      if (!authToken) {
        const intent = {
          token: SHARE_DATA.token,
          shareId: SHARE_DATA.shareId,
          snapshotVersion: SHARE_DATA.snapshotVersion,
          recipeIds: recipeIds || SHARE_DATA.recipes.map(r => r.id),
          title: label || 'המתכון המשותף',
          createdAt: new Date().toISOString()
        };
        try { localStorage.setItem('myrecipes_pending_share_save', JSON.stringify(intent)); } catch {}
        if (isInAppBrowser()) {
          const warn = document.getElementById('inapp-warning');
          warn.style.display = 'block';
          warn.innerHTML = \`
            <strong>שימו לב:</strong> דפדפן פנימי של וואטסאפ/אינסטגרם עלול לחסום התחברות בגוגל.<br/>
            לחצו על <strong>⋮ ← פתיחה בדפדפן חיצוני</strong> או העתיקו את הקישור לכרום/ספארי, ואז המשיכו לשמירה:<br/>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="copyShareUrlForBrowser()">📋 העתקת קישור לדפדפן</button>
              <button class="btn btn-outline" onclick="window.location.href='/app?saveShareToken=' + encodeURIComponent(SHARE_DATA.token)">המשך להתחברות כאן</button>
            </div>\`;
          warn.scrollIntoView({ behavior: 'smooth' });
          return;
        }
        trackPublicEvent('signup_started', { source: 'share_save' });
        window.location.href = '/app?saveShareToken=' + encodeURIComponent(SHARE_DATA.token);
        return;
      }

      const idemKey = SHARE_DATA.shareId + ':' + (recipeIds ? recipeIds.join(',') : 'all') + (forceDuplicate ? ':dup:' + Date.now() : '');
      try {
        const res = await fetch('/api/v1/shares/' + encodeURIComponent(SHARE_DATA.token) + '/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken,
            'Idempotency-Key': idemKey
          },
          body: JSON.stringify({ recipeIds, forceDuplicate: Boolean(forceDuplicate) })
        });
        if (res.status === 401) {
          try {
            localStorage.setItem('myrecipes_pending_share_save', JSON.stringify({
              token: SHARE_DATA.token,
              shareId: SHARE_DATA.shareId,
              snapshotVersion: SHARE_DATA.snapshotVersion,
              recipeIds: recipeIds || SHARE_DATA.recipes.map(r => r.id),
              title: label || 'המתכון המשותף',
              createdAt: new Date().toISOString()
            }));
          } catch {}
          trackPublicEvent('signup_started', { source: 'share_save_401' });
          window.location.href = '/app?saveShareToken=' + encodeURIComponent(SHARE_DATA.token);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          showToast(data.message || 'שגיאה בשמירת המתכון');
          return;
        }
        if (data.alreadySaved && data.savedCount === 0 && !forceDuplicate) {
          window.__lastSaveParams = { recipeIds, label };
          document.getElementById('save-modal-body').innerHTML = \`
            <p style="font-size:14px;color:#334155;">המתכון כבר שמור בספר שלך.</p>
            <div class="cta-row">
              <a class="btn btn-primary" href="/app">פתיחה בספר שלי</a>
              <button class="btn btn-outline" id="btn-force-duplicate-save">שמירת עותק נוסף</button>
            </div>\`;
          document.getElementById('btn-force-duplicate-save').onclick = function() {
            closeSaveModal();
            handleSaveClick(window.__lastSaveParams.recipeIds, window.__lastSaveParams.label, true);
          };
          document.getElementById('save-modal').classList.add('open');
          return;
        }
        if (data.failedCount > 0) {
          const failedIds = (data.items || []).filter(i => i.status === 'failed').map(i => i.sourceRecipeId);
          window.__lastFailedIds = failedIds;
          document.getElementById('save-modal-body').innerHTML = \`
            <p style="font-size:14px;">נשמרו \${data.savedCount} מתוך \${data.totalCount} מתכונים בהצלחה.</p>
            \${failedIds.length ? '<button class="btn btn-primary" id="btn-retry-failed-save">ניסיון חוזר לחסרים (' + failedIds.length + ')</button>' : ''}
          \`;
          const retryBtn = document.getElementById('btn-retry-failed-save');
          if (retryBtn) retryBtn.onclick = function() { closeSaveModal(); handleSaveClick(window.__lastFailedIds, label); };
          document.getElementById('save-modal').classList.add('open');
          return;
        }
        showToast('✅ נשמר בהצלחה בספר המתכונים שלך!');
      } catch (e) {
        showToast('שגיאת רשת בשמירה, אנא נסו שוב');
      }
    }

    function copyShareUrlForBrowser() {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        showToast('הקישור הועתק! פתחו אותו בדפדפן Chrome או Safari');
      }).catch(() => showToast(window.location.href));
    }

    function closeSaveModal() { document.getElementById('save-modal').classList.remove('open'); }
    function openReportModal() { document.getElementById('report-modal').classList.add('open'); }
    function closeReportModal() { document.getElementById('report-modal').classList.remove('open'); }

    async function submitReport() {
      const reason = document.getElementById('report-reason').value;
      const details = document.getElementById('report-details').value;
      try {
        await fetch('/api/public/shares/' + encodeURIComponent(SHARE_DATA.token) + '/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, details })
        });
        closeReportModal();
        showToast('הדיווח נשלח לבדיקה, תודה!');
      } catch {
        showToast('שגיאה בשליחת הדיווח');
      }
    }

    let currentBasketIndices = [0];
    async function openBasketModal(indices) {
      currentBasketIndices = indices && indices.length ? indices : [activeRecipeIndex];
      trackPublicEvent('ingredients_cta_clicked', { count: currentBasketIndices.length });
      document.getElementById('basket-modal').classList.add('open');
      if (!cachedMerchantsPayload) {
        try {
          const res = await fetch('/api/public/merchants');
          cachedMerchantsPayload = await res.json();
        } catch { cachedMerchantsPayload = { referralsEnabled: false, merchants: [], mappings: [] }; }
      }
      renderBasketBody();
    }

    function closeBasketModal() { document.getElementById('basket-modal').classList.remove('open'); }

    function setBasketMultiplier(val) {
      basketMultiplier = val;
      renderBasketBody();
    }

    function toggleHaveAtHome(id) {
      basketHaveAtHome[id] = !basketHaveAtHome[id];
      renderBasketBody();
    }

    function removeBasketItem(id) {
      basketRemovedIds[id] = true;
      renderBasketBody();
    }

    function copyBasketList() {
      const recipes = currentBasketIndices.map(i => SHARE_DATA.recipes[i]).filter(Boolean);
      const items = computeBasket(recipes, basketMultiplier).filter(i => !basketRemovedIds[i.id] && !basketHaveAtHome[i.id]);
      const text = items.map(i => '• ' + [i.displayQuantity, i.displayName].filter(Boolean).join(' ')).join('\\n');
      navigator.clipboard?.writeText(text).then(() => showToast('רשימת המצרכים הועתקה!'));
      trackPublicEvent('shopping_list_confirmed', { count: items.length });
    }

    async function goToMerchantSearch(merchantId, query, recipeId) {
      trackPublicEvent('ingredient_search_clicked', { merchantId, query });
      const win = window.open('about:blank', '_blank');
      if (win) { try { win.opener = null; } catch (_e) {} }
      try {
        const res = await fetch('/api/affiliate-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantId, query, shareId: SHARE_DATA.shareId, recipeId })
        });
        const data = await res.json();
        if (!res.ok || !data.redirectUrl) {
          if (win) win.close();
          showToast(data.message || 'החנות אינה זמינה כרגע');
          return;
        }
        if (win) win.location.href = data.redirectUrl;
        else window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
      } catch {
        if (win) win.close();
        showToast('שגיאה בפתיחת קישור לחנות');
      }
    }

    function renderBasketBody() {
      const recipes = currentBasketIndices.map(i => SHARE_DATA.recipes[i]).filter(Boolean);
      const items = computeBasket(recipes, basketMultiplier).filter(i => !basketRemovedIds[i.id]);
      const enabledMerchants = ((cachedMerchantsPayload && cachedMerchantsPayload.merchants) || []).filter(m => m.selectable);
      if (!selectedMerchantId && enabledMerchants.length > 0) selectedMerchantId = enabledMerchants[0].id;
      const activeMerchant = enabledMerchants.find(m => m.id === selectedMerchantId) || enabledMerchants[0] || null;
      const mappings = (cachedMerchantsPayload && cachedMerchantsPayload.mappings) || [];

      const multBtns = [0.5, 1, 2, 3].map(m =>
        '<button class="btn ' + (basketMultiplier === m ? 'btn-primary' : 'btn-outline') + '" style="padding:6px 10px;font-size:12px;" onclick="setBasketMultiplier(' + m + ')">x' + m + '</button>'
      ).join('');

      const merchantSelector = enabledMerchants.length > 0
        ? '<div style="margin:10px 0;"><div style="font-size:12px;font-weight:700;margin-bottom:6px;">בחירת חנות לחיפוש מצרכים:</div><div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          enabledMerchants.map(m => '<button class="btn ' + (activeMerchant && activeMerchant.id === m.id ? 'btn-primary' : 'btn-outline') + '" style="padding:7px 12px;font-size:12px;" data-select-merchant="' + esc(m.id) + '">' + esc(m.displayName) + '</button>').join('') +
          '</div><div class="disclosure">' + esc((activeMerchant && activeMerchant.disclosureText) || SHARE_DATA.defaultDisclosureText) + '</div></div>'
        : '<div class="disclosure">חיפוש ישיר בחנויות יתווסף בקרוב — בינתיים ניתן להעתיק את הרשימה.</div>';

      const rowsHtml = items.map((item, itemIdx) => {
        const have = Boolean(basketHaveAtHome[item.id]);
        const skuMatch = activeMerchant ? mappings.find(mp => mp.merchantId === activeMerchant.id && mp.normalizedName.toLowerCase() === item.searchQuery.toLowerCase()) : null;
        return \`
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;opacity:\${have ? '0.5' : '1'};">
            <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer;">
              <input type="checkbox" \${have ? 'checked' : ''} data-toggle-home-idx="\${itemIdx}" />
              <div>
                <div style="font-weight:700;font-size:14px;\${have ? 'text-decoration:line-through;' : ''}">\${esc(item.displayName)}</div>
                <div style="font-size:12px;color:#475569;">\${esc(item.displayQuantity || item.originalLines[0] || '')}</div>
                \${skuMatch ? '<div style="font-size:11px;color:#059669;">הצעת מוצר: ' + esc(skuMatch.productName) + ' (עודכן ' + esc((skuMatch.verifiedAt || '').slice(0,10)) + ')</div>' : ''}
              </div>
            </label>
            <div style="display:flex;gap:6px;align-items:center;">
              \${activeMerchant && !have ? '<button class="btn btn-secondary" style="padding:6px 10px;font-size:12px;" data-merchant-search-idx="' + itemIdx + '">מעבר לחנות</button>' : ''}
              <button class="btn btn-outline" style="padding:4px 8px;font-size:12px;" data-remove-basket-idx="\${itemIdx}">✕</button>
            </div>
          </div>\`;
      }).join('');

      window.__currentBasketItems = items;
      window.__currentBasketActiveMerchant = activeMerchant;
      window.__currentBasketRecipeId = recipes[0]?.id || '';

      document.getElementById('basket-body').innerHTML = \`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;font-weight:700;">הכפלת כמויות:</span>\${multBtns}</div>
          <button class="btn btn-primary" style="padding:8px 12px;font-size:12px;" onclick="copyBasketList()">📋 העתקת הרשימה</button>
        </div>
        \${merchantSelector}
        <div style="font-size:11px;color:#64748b;margin-bottom:8px;">סמנו "יש לי בבית" כדי להוציא פריטים מהרשימה (נשמר במכשירך בלבד).</div>
        \${rowsHtml || '<div style="text-align:center;color:#64748b;padding:20px;">אין מצרכים ברשימה</div>'}
      \`;
    }

    document.addEventListener('click', function(ev) {
      const saveBtn = ev.target.closest('[data-save-recipe-idx]');
      if (saveBtn) {
        const idx = Number(saveBtn.dataset.saveRecipeIdx);
        const rec = SHARE_DATA.recipes[idx];
        if (rec) handleSaveClick([rec.id], rec.title);
        return;
      }
      const saveAllBtn = ev.target.closest('[data-save-all]');
      if (saveAllBtn) {
        handleSaveClick(null, SHARE_DATA.bookTitle || 'הספר המשותף');
        return;
      }
      const merchBtn = ev.target.closest('[data-select-merchant]');
      if (merchBtn) {
        selectedMerchantId = merchBtn.dataset.selectMerchant;
        trackPublicEvent('merchant_selected', { merchantId: selectedMerchantId });
        renderBasketBody();
        return;
      }
      const searchBtn = ev.target.closest('[data-merchant-search-idx]');
      if (searchBtn && window.__currentBasketActiveMerchant) {
        const item = window.__currentBasketItems[Number(searchBtn.dataset.merchantSearchIdx)];
        if (item) goToMerchantSearch(window.__currentBasketActiveMerchant.id, item.searchQuery, window.__currentBasketRecipeId);
        return;
      }
      const remBtn = ev.target.closest('[data-remove-basket-idx]');
      if (remBtn) {
        const item = window.__currentBasketItems[Number(remBtn.dataset.removeBasketIdx)];
        if (item) removeBasketItem(item.id);
      }
    });

    document.addEventListener('change', function(ev) {
      const homeCb = ev.target.closest('[data-toggle-home-idx]');
      if (homeCb && window.__currentBasketItems) {
        const item = window.__currentBasketItems[Number(homeCb.dataset.toggleHomeIdx)];
        if (item) toggleHaveAtHome(item.id);
      }
    });

    if (SHARE_DATA.type === 'book') {
      renderBookOverview('');
    } else if (SHARE_DATA.recipes[0]) {
      document.getElementById('main-content').innerHTML = renderRecipeDetail(SHARE_DATA.recipes[0], false);
    }
  </script>
</body>
</html>`;
}
