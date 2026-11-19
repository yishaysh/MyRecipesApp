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
      width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 20px 20px 0 0; padding: 14px;
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
    .save-blocking-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px);
      z-index: 99999; display: none; align-items: center; justify-content: center; pointer-events: all; padding: 20px;
    }
    .save-blocking-overlay.open { display: flex; }
    .save-blocking-card {
      background: #fff; border-radius: 18px; padding: 24px 22px; max-width: 340px; width: 100%;
      text-align: center; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28); border: 1px solid #e2e8f0;
    }
    .save-spinner {
      width: 44px; height: 44px; margin: 0 auto 14px; border: 4px solid #d1fae5;
      border-top-color: #059669; border-radius: 50%; animation: shareSpin 0.8s linear infinite;
    }
    @keyframes shareSpin { to { transform: rotate(360deg); } }
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

  <div id="save-blocking-loader" class="save-blocking-overlay" role="alertdialog" aria-modal="true" aria-live="polite">
    <div class="save-blocking-card">
      <div class="save-spinner"></div>
      <div id="save-loader-title" style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:6px;">⏳ שומר לספר המתכונים שלך...</div>
      <div id="save-loader-sub" style="font-size:13px;color:#475569;line-height:1.5;">מעתיק ומסנכרן את המתכונים לחשבון שלך. אנא המתינו...</div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const SHARE_DATA = ${safeJsonForInlineScript(clientPayload)};
    let activeRecipeIndex = 0;
    let basketMultiplier = 1;
    let basketHaveAtHome = {};
    let basketSkippedIds = {};
    let basketSelfBoughtIds = {};
    let basketSelectedAlternatives = {};
    let basketCustomOverrides = {};
    let basketEditingId = null;
    let basketListRevision = 1;
    let basketCompareSeq = 0;
    let basketShowPlainBox = false;
    let basketShowChainDetails = false;
    let basketShowHandoffDetails = false;
    let basketHandoffFeedback = null;
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

    const UNITS_TO_STRIP_JS = new Set([
      'גרם', 'גר', 'ג', 'ג׳', "ג'", 'ק"ג', 'ק״ג', 'קג', 'קילו', 'קילוגרם',
      'מ"ל', 'מ״ל', 'מל', 'ליטר', 'ל', 'ליטרים', 'כוס', 'כוסות', 'כף', 'כפות',
      'כפית', 'כפיות', 'יחידה', 'יחידות', 'יח', "יח'", 'יח׳', 'קורט', 'קמצוץ',
      'חבילה', 'חבילות', 'שקית', 'שקיות', 'קופסה', 'קופסאות', 'גביע', 'גביעים', 'פחית', 'פחיות', 'צנצנת',
      'שן', 'שיניים', 'שיני', 'ענף', 'ענפים', 'צרור', 'צרורות', 'פרוסה', 'פרוסות', 'עלה', 'עלים',
      'g', 'gr', 'gram', 'grams', 'kg', 'ml', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'pcs', 'piece', 'pieces'
    ]);

    const MODIFIERS_TO_STRIP_JS = new Set([
      'גדול', 'גדולה', 'גדולים', 'גדולות', 'קטן', 'קטנה', 'קטנים', 'קטנות',
      'בינוני', 'בינונית', 'בינוניים', 'בינוניות', 'טרי', 'טרייה', 'טריים', 'טריות',
      'קצוץ', 'קצוצה', 'קצוצים', 'קצוצות', 'מגורד', 'מגורדת', 'מגורדים', 'מגורדות', 'מגורר', 'מגוררת', 'מגוררים',
      'כתוש', 'כתושה', 'כתושים', 'כתושות', 'פרוס', 'פרוסה', 'פרוסים', 'פרוסות',
      'טחון', 'טחונה', 'טחונים', 'טחונות', 'חתוך', 'חתוכה', 'חתוכים', 'חתוכות', 'לקוביות',
      'קלוף', 'קלופה', 'קלופים', 'מקולף', 'מקולפת', 'מקולפים', 'שטוף', 'שטופה', 'שטופים',
      'מומס', 'מומסת', 'רך', 'רכה', 'קפוא', 'קפואה', 'קפואים', 'מבושל', 'מבושלת', 'אפוי', 'קלוי', 'קלויה', 'קלויים',
      'מאוד', 'דק', 'גס', 'אופציונלי', 'להגשה', 'לקישוט', 'לטיגון', 'לאפייה',
      'fresh', 'chopped', 'minced', 'diced', 'sliced', 'grated', 'large', 'medium', 'small', 'optional'
    ]);

    const PURCHASABLE_EXTRA_MODIFIERS_JS = new Set([
      'גרוס', 'גרוסה', 'גרוסים', 'גרוסות', 'שלם', 'שלמה', 'שלמים', 'שלמות',
      'חם', 'חמים', 'חמה', 'קר', 'קרים', 'קרה', 'בטמפרטורת', 'החדר'
    ]);

    const KNOWN_SPLIT_SECOND_ITEMS_JS = [
      'פלפל שחור', 'פלפל לבן', 'פלפל אנגלי', 'פלפל', 'מלח', 'מיונז', 'קטשופ', 'חרדל',
      "סריראצ'ה", 'סריראצה', 'טחינה', 'כוסברה', 'פטרוזיליה', 'שמיר', 'נענע', 'בזיליקום',
      'שום', 'בצל', 'לימון', 'חומץ', 'סוכר', 'קינמון', 'כמון', 'פפריקה'
    ];

    function extractDietaryConstraintsJs(rawText) {
      const text = String(rawText || '').replace(/[״"]/g, '"').replace(/[׳']/g, "'");
      if (!text.trim()) return [];
      const found = [];
      const add = (c) => { if (!found.includes(c)) found.push(c); };
      if (/ללא\\s+גלוטן|נטול\\s+גלוטן/.test(text)) add('ללא גלוטן');
      if (/טבעוני(?:ת|ים|ות)?/.test(text)) add('טבעוני');
      if (/ללא\\s+לקטוז|נטול\\s+לקטוז/.test(text)) add('ללא לקטוז');
      if (/כשר\\s+לפסח|כשל"פ/.test(text)) add('כשר לפסח');
      if (/ללא\\s+(?:תוספת\\s+)?סוכר/.test(text)) add('ללא סוכר');
      if (/קמח\\s+מלא|מחיטה\\s+מלאה/.test(text)) add('קמח מלא');
      if (/כוסמין/.test(text)) add('כוסמין');
      if (/אורגני(?:ת|ים|ות)?/.test(text)) add('אורגני');
      return found;
    }

    function parseNumericAmountJs(rawAmount) {
      if (typeof rawAmount === 'number') return Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null;
      if (typeof rawAmount === 'string') {
        const trimmed = rawAmount.trim();
        if (!trimmed) return null;
        if (trimmed === '½') return 0.5;
        if (trimmed === '¼') return 0.25;
        if (trimmed === '¾') return 0.75;
        if (trimmed === '⅓') return 0.33;
        if (trimmed === '⅔') return 0.67;
        if (/^\\d+\\/\\d+$/.test(trimmed)) {
          const parts = trimmed.split('/').map(Number);
          return parts[1] > 0 ? parts[0] / parts[1] : null;
        }
        const n = parseFloat(trimmed.replace(',', '.'));
        return Number.isFinite(n) && n > 0 ? n : null;
      }
      return null;
    }

    function isSectionHeaderIngredientJs(ing) {
      const rawName = (typeof ing === 'string' ? ing : String((ing && ing.name) || '')).trim();
      if (!rawName) return true;
      const hasNum = typeof ing === 'object' && ing !== null && parseNumericAmountJs(ing.amount) !== null;
      const hasUnit = typeof ing === 'object' && ing !== null && Boolean(String(ing.unit || '').trim());
      if (!hasNum && !hasUnit) {
        if (/[:：]\\s*$/.test(rawName)) return true;
        if (/^(?:לרוטב|לבצק|למילוי|לציפוי|לקרם|לסירופ|לסלט|לתיבול|להגשה|לקישוט|למרינדה|לתערובת|לשכבה|לפסטה|למרק|למוקפץ)\\s*:?$/.test(rawName)) return true;
      }
      return false;
    }

    const NON_PURCHASABLE_WATER_PATTERNS_JS = [
      /^(?:מים|מי\\s+ברז|מי\\s+בישול|מי\\s+(?:ה)?פסטה|מי\\s+השריה|קרח|קוביות\\s+קרח|מי\\s+קרח)$/,
      /^מים\\s+(?:רותחים|חמים|קרים|פושרים|מסוננים|נקיים|צוננים|רגילים|בטמפרטורת\\s+החדר|בטמפ['׳]\\s+החדר|לבישול|להשריה|לפי\\s+הצורך|לכיסוי)(?:\\s+(?:רותחים|חמים|קרים|פושרים|מסוננים|לפי\\s+הצורך|לכיסוי))*$/
    ];

    function isNonPurchasableHouseholdItemJs(ing) {
      const rawName = (typeof ing === 'string' ? ing : String((ing && ing.name) || '')).trim();
      if (!rawName) return true;
      let cleaned = rawName
        .replace(/[״"]/g, '"')
        .replace(/[׳']/g, "'")
        .replace(/[\\u0591-\\u05C7]/g, '')
        .replace(/\\([^)]*\\)/g, ' ')
        .replace(/\\[[^\\]]*\\]/g, ' ')
        .replace(/^[\\s•\\-*✓✔☑☐\\d.,/½¼¾⅓⅔+]+/, ' ')
        .trim();
      for (let i = 0; i < 3; i++) {
        const m = cleaned.match(/^(?:כוסות|כוס|כפות|כף|כפיות|כפית|ליטרים|ליטר|מ"ל|מל|ק"ג|גרם|חצי|רבע|שליש|קצת|מעט|קערת|סיר|כמה)(?:\\s+של)?\\s+/i);
        if (m) cleaned = cleaned.substring(m[0].length).trim();
        else break;
      }
      cleaned = cleaned.replace(/\\s+/g, ' ').trim();
      if (!cleaned) return true;
      if (/קוקוס|ורדים|זהר|הדרים|סודה|מוגז|מינרל/.test(cleaned)) return false;
      return NON_PURCHASABLE_WATER_PATTERNS_JS.some(p => p.test(cleaned));
    }

    function normalizeUnitKeyJs(rawUnit) {
      const clean = String(rawUnit || '').trim().toLowerCase();
      if (!clean) return '';
      if (clean === 'גר' || clean === 'ג׳' || clean === "ג'" || clean === 'g' || clean === 'gr' || clean === 'gram' || clean === 'grams') return 'גרם';
      if (clean === 'ק״ג' || clean === 'ק"ג' || clean === 'קג' || clean === 'קילו' || clean === 'קילוגרם' || clean === 'kg') return 'ק"ג';
      if (clean === 'מ״ל' || clean === 'מ"ל' || clean === 'מל' || clean === 'ml') return 'מ"ל';
      if (clean === 'ליטרים' || clean === 'l' || clean === 'liter' || clean === 'liters') return 'ליטר';
      if (clean === 'כוסות' || clean === 'cup' || clean === 'cups') return 'כוסות';
      if (clean === 'כוס') return 'כוס';
      if (clean === 'כפות' || clean === 'tbsp') return 'כפות';
      if (clean === 'כף') return 'כף';
      if (clean === 'כפיות' || clean === 'tsp') return 'כפיות';
      if (clean === 'כפית') return 'כפית';
      if (clean === 'יחידה' || clean === 'יחידות' || clean === "יח'" || clean === 'יח׳') return 'יחידות';
      return clean;
    }

    function normalizeSearchName(item) {
      const rawName = typeof item === 'string' ? item : String((item && item.name) || '');
      const constraintsInParens = extractDietaryConstraintsJs((rawName.match(/\\([^)]*\\)/g) || []).join(' '));
      const cleaned = rawName
        .replace(/\\([^)]*\\)/g, ' ')
        .replace(/\\[[^\\]]*\\]/g, ' ')
        .replace(/לפי הטעם|לפי הצורך|לא חובה|להגשה|לקישוט/g, ' ')
        .replace(/^[\\d.,/½¼¾⅓⅔\\-\\s]+/, ' ')
        .replace(/[״"]/g, '"')
        .replace(/[׳']/g, "'");
      const tokens = cleaned.split(/\\s+/).map(t => t.replace(/^[,.:;!?]+|[,.:;!?]+$/g, '')).filter(Boolean);
      const kept = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const lower = token.toLowerCase();
        if (/^[\\d.,/½¼¾⅓⅔\\-]+$/.test(token)) continue;
        if (UNITS_TO_STRIP_JS.has(lower)) continue;
        if (MODIFIERS_TO_STRIP_JS.has(lower)) continue;
        kept.push(token);
      }
      let result = kept.join(' ').replace(/\\s+/g, ' ').trim();
      for (let j = 0; j < constraintsInParens.length; j++) {
        const c = constraintsInParens[j];
        if (result && !result.includes(c)) result = (result + ' ' + c).trim();
      }
      return result || rawName.replace(/\\([^)]*\\)/g, ' ').replace(/\\s+/g, ' ').trim();
    }

    const GROCERY_PREP_PHRASE_PATTERNS_JS = [
      /(?:^|\\s)ללא\\s+(?:ה)?קליפה(?=\\s|$)/g,
      /(?:^|\\s)בלי\\s+(?:ה)?קליפה(?=\\s|$)/g,
      /(?:^|\\s)ללא\\s+(?:ה)?גרעינים(?=\\s|$)/g,
      /(?:^|\\s)בלי\\s+(?:ה)?גרעינים(?=\\s|$)/g,
      /(?:^|\\s)ללא\\s+(?:ה)?חרצנים(?=\\s|$)/g,
      /(?:^|\\s)בלי\\s+(?:ה)?חרצנים(?=\\s|$)/g,
      /(?:^|\\s)ללא\\s+(?:ה)?עצמות(?=\\s|$)/g,
      /(?:^|\\s)בלי\\s+(?:ה)?עצמות(?=\\s|$)/g,
      /(?:^|\\s)ללא\\s+(?:ה)?עור(?=\\s|$)/g,
      /(?:^|\\s)בלי\\s+(?:ה)?עור(?=\\s|$)/g,
      /(?:^|\\s)בטמפרטורת\\s+החדר(?=\\s|$)/g,
      /(?:^|\\s)בטמפ['׳]\\s+החדר(?=\\s|$)/g,
      /(?:^|\\s)חתו[ךכ](?:ה|ים|ות)?\\s+ל(?:דק|גס|קוביות|רצועות|טבעות|חתיכות|פרוסות|רבעים|חצאים)(?=\\s|$)/g,
      /(?:^|\\s)(?:קצוץ|קצוצה|קצוצים|קצוצות)\\s+(?:דק|גס)(?=\\s|$)/g,
      /(?:^|\\s)(?:פרוס|פרוסה|פרוסים|פרוסות)\\s+(?:דק|גס)(?=\\s|$)/g,
      /(?:^|\\s)(?:מגורר|מגוררת|מגוררים|מגוררות|מגורד|מגורדת|מגורדים|מגורדות)\\s+(?:דק|גס)(?=\\s|$)/g,
      /(?:^|\\s)(?:סחוט|סחוטה)\\s+(?:טרי|טרייה)(?=\\s|$)/g,
      /(?:^|\\s)(?:שטוף|שטופה|שטופים|שטופות)(?:\\s+(?:היטב|ויבש|ומיובש|ומיובשת|ויבשים))?(?=\\s|$)/g,
      /(?:^|\\s)כתית\\s+מעולה(?=\\s|$)/g,
      /(?:^|\\s)(?:לפי\\s+הטעם|לפי\\s+הצורך|כמה\\s+שצריך|אם\\s+צריך|לא\\s+חובה|אופציונלי|לבחירה)(?=\\s|$)/g,
      /(?:^|\\s)(?:לקישוט|להגשה|לעיטור|לטיגון|לאפייה|לבישול|למריחה|לטבילה)(?=\\s|$)/g,
      /(?:^|\\s)(?:מופשר|מופשרת|מופשרים|מומס|מומסת|מרוכך|מרוככת|מעוך|מעוכה|מעוכים)(?=\\s|$)/g,
      /(?:^|\\s)(?:כתוש|כתושה|כתושים|כתושות|קלוף|קלופה|קלופים|קלופות|מקולף|מקולפת|מקולפים|מקולפות|מגולען|מגולענת|מגולענים|מגולענות)(?=\\s|$)/g,
      /(?:^|\\s)(?:קצוץ|קצוצה|קצוצים|קצוצות|מגורר|מגוררת|מגוררים|מגוררות|מגורד|מגורדת|מגורדים|מגורדות|חתוך|חתוכה|חתוכים|חתוכות)(?=\\s|$)/g
    ];

    const GROCERY_DROP_TOKENS_JS = new Set([
      'טרי', 'טרייה', 'טריים', 'טריות',
      'גדול', 'גדולה', 'גדולים', 'גדולות',
      'קטן', 'קטנה', 'קטנים', 'קטנות',
      'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
      'דק', 'דקה', 'דקים', 'דקות',
      'גס', 'גסה', 'גסים', 'גסות',
      'חם', 'חמים', 'חמה', 'חמות',
      'קר', 'קרים', 'קרה', 'קרות',
      'פושר', 'פושרת', 'פושרים',
      'רותח', 'רותחת', 'רותחים',
      'רך', 'רכה',
      'בשל', 'בשלה', 'בשלים', 'בשלות',
      'נקי', 'נקייה', 'נקיים', 'נקיות',
      'שלם', 'שלמה', 'שלמים', 'שלמות',
      'גרוס', 'גרוסה', 'גרוסים', 'גרוסות',
      'סחוט', 'סחוטה',
      'מטוגן', 'מטוגנת', 'מטוגנים',
      'צלוי', 'צלויה', 'צלויים',
      'מבושל', 'מבושלת', 'מבושלים',
      'אפוי', 'אפויה', 'אפויים'
    ]);

    const GROUND_MEAT_KEEP_PREFIXES_JS = new Set(['בשר', 'בקר', 'עוף', 'הודו', 'כבש', 'טלה', 'דג']);
    const DRY_KEEP_PREFIXES_JS = new Set(['יין', 'בצל', 'עגבניות', 'פירות', 'שמרים']);

    function normalizePurchasableTokenStringJs(raw, dietaryConstraints) {
      const rawStr = String(raw || '');
      const constraintsInParens = extractDietaryConstraintsJs((rawStr.match(/\\([^)]*\\)/g) || []).join(' '));
      const allConstraints = Array.from(new Set((dietaryConstraints || []).concat(constraintsInParens)));

      let text = rawStr
        .replace(/[״"]/g, '"')
        .replace(/[׳']/g, "'")
        .replace(/[\\u0591-\\u05C7]/g, '')
        .replace(/\\([^)]*\\)/g, ' ')
        .replace(/\\[[^\\]]*\\]/g, ' ')
        .replace(/^[\\s•\\-*✓✔☑☐\\d.,/½¼¾⅓⅔+]+/, ' ')
        .trim();

      if (!text) return '';

      for (let i = 0; i < GROCERY_PREP_PHRASE_PATTERNS_JS.length; i++) {
        text = text.replace(GROCERY_PREP_PHRASE_PATTERNS_JS[i], ' ');
      }
      text = text.replace(/\\s+/g, ' ').trim();

      for (let iter = 0; iter < 4; iter++) {
        text = text.trim();
        if (/^עלי\\s+(?:דפנה|גפן|סיגר|פילו|לזניה|בייבי|תבלין)(?:\\s|$)/.test(text)) break;
        if (/^עלי\\s+/.test(text)) {
          text = text.replace(/^עלי\\s+/, '');
          continue;
        }
        if (/^נתח\\s+קצבים(?:\\s|$)/.test(text)) break;
        const prefixMatch = text.match(/^(?:טבעות|רצועות|קוביות|פרוסות|פרוסת|פרוס|חצאי|רבעי|חתיכות|חתיכת|נתחי|נתח|שבבי|פתיתי|גבעולי|גבעול|ענפי|ענף|שיני|שן|ראשי|ראש|צרור|זר|חופן|קליפת|גרידת|חבילת|חבילה|שקית|קופסת|קופסה|פחית|צנצנת|גביע|כוסות|כוס|כפות|כף|כפיות|כפית|קורט|קמצוץ|קילו|ק"ג|גרם|מ"ל|ליטר)(?:\\s+של)?\\s+/);
        if (prefixMatch) {
          text = text.substring(prefixMatch[0].length);
        } else {
          break;
        }
      }

      const rawTokens = text
        .trim()
        .split(/\\s+/)
        .map(t => t.replace(/^[,.:;!?]+|[,.:;!?]+$/g, ''))
        .filter(Boolean);

      const kept = [];
      for (let i = 0; i < rawTokens.length; i++) {
        const token = rawTokens[i];
        const lower = token.toLowerCase();
        const prev = kept.length > 0 ? kept[kept.length - 1] : '';
        if (/^[\\d.,/½¼¾⅓⅔\\-]+$/.test(token)) continue;
        if (UNITS_TO_STRIP_JS.has(lower)) continue;
        if (GROCERY_DROP_TOKENS_JS.has(lower) || PURCHASABLE_EXTRA_MODIFIERS_JS.has(lower)) continue;
        if (/^טחון(?:ה|ים|ות)?$/.test(token)) {
          if (GROUND_MEAT_KEEP_PREFIXES_JS.has(prev)) kept.push(token);
          continue;
        }
        if (/^יבש(?:ה|ים|ות)?$/.test(token)) {
          if (DRY_KEEP_PREFIXES_JS.has(prev) || (kept.length >= 2 && DRY_KEEP_PREFIXES_JS.has(kept[kept.length - 2]))) {
            kept.push(token);
          }
          continue;
        }
        kept.push(token);
      }

      let name = kept.join(' ').replace(/\\s+/g, ' ').trim();
      if (!name) name = normalizeSearchName(rawStr);

      if (name === 'ביצה') name = 'ביצים';
      if (name === 'בצלים') name = 'בצל';
      if (name === 'עגבניה' || name === 'עגבנייה') name = 'עגבניות';
      if (name === 'לימונים') name = 'לימון';
      if (name === 'שן שום' || name === 'שיני שום' || name === 'ראש שום' || name === 'ראשי שום') name = 'שום';
      if (/^גבינת\\s+(?:פקורינו|פרמזן|גראנה\\s+פדאנו|מסקרפונה|ריקוטה|מוצרלה)(?:\\s|$)/.test(name)) {
        name = name.replace(/^גבינת\\s+/, '');
      }
      if (name === 'מלח ים' || name === 'מלח שולחן' || name === 'מלח שולחני' || name === 'מלח דק' || name === 'מלח גס' || name === 'מלח בישול') {
        name = 'מלח';
      }
      if (name === 'סוכר לבן') name = 'סוכר';

      for (let i = 0; i < allConstraints.length; i++) {
        const c = allConstraints[i];
        if (name && !name.includes(c)) {
          if (c === 'קמח מלא' && name.includes('קמח')) {
            if (!name.includes('מלא')) name = name + ' מלא';
          } else {
            name = (name + ' ' + c).trim();
          }
        }
      }
      return name;
    }

    function extractLeadingAmountAndUnitFromNameJs(rawName) {
      const trimmed = String(rawName || '').trim();
      const match = trimmed.match(/^(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|[½¼¾⅓⅔])\\s*(גרם|גר|ג׳|ג'|ק"ג|ק״ג|קג|קילו|קילוגרם|מ"ל|מ״ל|מל|ליטר|כוסות|כוס|כפות|כף|כפיות|כפית|יחידות|יחידה|יח'|יח׳|שן|שיני|שיניים)?\\s+(.+)$/);
      if (!match) return { amount: null, unit: '', restName: trimmed };
      return { amount: parseNumericAmountJs(match[1]), unit: match[2] || '', restName: match[3].trim() };
    }

    function formatScaledAmountJs(amount) {
      const rounded = Math.round(amount * 100) / 100;
      if (Number.isInteger(rounded)) return String(rounded);
      return String(rounded).replace(/\\.0+$/, '').replace(/(\\.\\d*[1-9])0+$/, '$1');
    }

    function formatOriginalIngredientLineJs(ing, multiplier) {
      const cleanName = String(ing.name || '').replace(/[״"]/g, '"').replace(/[׳']/g, "'").trim();
      const isToTaste = ing.qtyMode === 'to_taste' || String(ing.amount || '').trim() === 'לפי הטעם' || /לפי הטעם/.test(cleanName);
      if (isToTaste) {
        const baseName = cleanName.replace(/\\s*\\(?לפי הטעם\\)?\\s*/g, ' ').replace(/\\s+/g, ' ').trim();
        return baseName + ' (לפי הטעם)';
      }
      let num = parseNumericAmountJs(ing.amount);
      let unit = String(ing.unit || '').trim();
      let displayIngName = cleanName;
      if (num === null) {
        const parsedFromName = extractLeadingAmountAndUnitFromNameJs(cleanName);
        if (parsedFromName.amount !== null) {
          num = parsedFromName.amount;
          if (!unit && parsedFromName.unit) unit = parsedFromName.unit;
          displayIngName = parsedFromName.restName;
        }
      }
      if (num !== null) {
        const scaled = formatScaledAmountJs(num * multiplier);
        return [scaled, unit, displayIngName].filter(Boolean).join(' ');
      }
      return [unit, displayIngName].filter(Boolean).join(' ').trim();
    }

    function analyzeAndTransformIngredientNameJs(rawName) {
      const stdName = String(rawName || '').replace(/[״"]/g, '"').replace(/[׳']/g, "'").trim();
      const dietaryConstraints = extractDietaryConstraintsJs(stdName);
      const withoutToTaste = stdName
        .replace(/\\(\\s*לפי הטעם\\s*\\)/g, ' ')
        .replace(/לפי הטעם|לפי הצורך/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
      const withoutParens = withoutToTaste.replace(/\\([^)]*\\)/g, ' ').replace(/\\s+/g, ' ').trim();

      if (/(?:^|\\s)מלח(?:\\s|$|,)/.test(withoutParens) && /(?:^|\\s)ו-?פלפל(?:\\s|$)|,\\s*פלפל(?:\\s|$)/.test(withoutParens)) {
        const pepperVariant = /פלפל\\s+לבן/.test(withoutParens) ? 'פלפל לבן' : (/פלפל\\s+אנגלי/.test(withoutParens) ? 'פלפל אנגלי' : 'פלפל שחור');
        return [
          { shoppingName: 'מלח', alternatives: [], requiresUserReview: false, conversionNote: null, dietaryConstraints, wasSplitFromCombined: true },
          { shoppingName: pepperVariant, alternatives: [], requiresUserReview: false, conversionNote: null, dietaryConstraints, wasSplitFromCombined: true }
        ];
      }

      for (let i = 0; i < KNOWN_SPLIT_SECOND_ITEMS_JS.length; i++) {
        const secondItem = KNOWN_SPLIT_SECOND_ITEMS_JS[i];
        const escapedSecond = secondItem.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        const regex = new RegExp('^(.+?)\\\\s+ו-?(' + escapedSecond + ')(?:\\\\s+.*)?$', 'i');
        const match = withoutParens.match(regex);
        if (match) {
          const leftClean = normalizePurchasableTokenStringJs(match[1], dietaryConstraints);
          let rightClean = normalizePurchasableTokenStringJs(match[2], dietaryConstraints);
          if (leftClean === 'מלח' && rightClean === 'פלפל') rightClean = 'פלפל שחור';
          if (leftClean && rightClean && leftClean !== rightClean) {
            return [
              { shoppingName: leftClean, alternatives: [], requiresUserReview: false, conversionNote: null, dietaryConstraints, wasSplitFromCombined: true },
              { shoppingName: rightClean, alternatives: [], requiresUserReview: false, conversionNote: null, dietaryConstraints, wasSplitFromCombined: true }
            ];
          }
        }
      }

      if (/(?:חלמונים|חלמון(?:\\s+ביצה)?|חלמוני\\s+ביצה|חלבונים|חלבון(?:\\s+ביצה)?|חלבוני\\s+ביצה)/.test(withoutParens)) {
        const eggName = normalizePurchasableTokenStringJs('ביצים', dietaryConstraints);
        return [{
          shoppingName: eggName,
          alternatives: [],
          requiresUserReview: true,
          conversionNote: 'הומר מחלמונים לביצים — בדקו כמות מארז',
          dietaryConstraints,
          wasSplitFromCombined: false
        }];
      }

      if (/(?:גרידת\\s+לימון|קליפת\\s+לימון|מיץ\\s+לימון(?:\\s+טרי)?|מיץ\\s+מלימון|גרידה\\s+מלימון)/.test(withoutParens)) {
        const lemonName = normalizePurchasableTokenStringJs('לימון', dietaryConstraints);
        return [{
          shoppingName: lemonName,
          alternatives: [],
          requiresUserReview: true,
          conversionNote: 'הומר ממיץ/גרידת לימון ללימון שלם',
          dietaryConstraints,
          wasSplitFromCombined: false
        }];
      }

      const parenAltMatch = withoutToTaste.match(/^(.*?)\\(\\s*או\\s+([^)]+)\\)(.*)$/);
      if (parenAltMatch) {
        const mainRaw = (parenAltMatch[1] + ' ' + parenAltMatch[3]).trim();
        const altRaw = parenAltMatch[2].trim();
        const mainClean = normalizePurchasableTokenStringJs(mainRaw, dietaryConstraints);
        const altParts = altRaw.split(/\\s+או\\s+/).map(p => normalizePurchasableTokenStringJs(p, dietaryConstraints)).filter(p => Boolean(p) && !MODIFIERS_TO_STRIP_JS.has(p));
        const alternatives = Array.from(new Set([mainClean].concat(altParts).filter(Boolean)));
        if (alternatives.length >= 2) {
          return [{
            shoppingName: alternatives[0],
            alternatives,
            requiresUserReview: true,
            conversionNote: null,
            dietaryConstraints,
            wasSplitFromCombined: false
          }];
        }
      }

      if (/\\s+או\\s+/.test(withoutParens)) {
        const rawParts = withoutParens.split(/\\s+או\\s+/);
        const alternatives = Array.from(new Set(rawParts.map(p => normalizePurchasableTokenStringJs(p, dietaryConstraints)).filter(Boolean)));
        if (alternatives.length >= 2) {
          return [{
            shoppingName: alternatives[0],
            alternatives,
            requiresUserReview: true,
            conversionNote: null,
            dietaryConstraints,
            wasSplitFromCombined: false
          }];
        }
      }

      const shoppingName = normalizePurchasableTokenStringJs(withoutToTaste, dietaryConstraints);
      return [{
        shoppingName,
        alternatives: [],
        requiresUserReview: false,
        conversionNote: null,
        dietaryConstraints,
        wasSplitFromCombined: false
      }];
    }

    function computeBasket(recipes, mult) {
      const safeMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
      const groups = new Map();
      (recipes || []).forEach(recipe => {
        (recipe.ingredients || []).forEach(rawIng => {
          const ing = typeof rawIng === 'string' ? { name: rawIng } : rawIng;
          if (!ing || !String(ing.name || '').trim()) return;
          if (isSectionHeaderIngredientJs(ing) || isNonPurchasableHouseholdItemJs(ing)) return;

          const originalLine = formatOriginalIngredientLineJs(ing, safeMult);
          const candidates = analyzeAndTransformIngredientNameJs(ing.name);

          let numericAmount = parseNumericAmountJs(ing.amount);
          let rawUnit = String(ing.unit || '').trim();
          if (numericAmount === null) {
            const extracted = extractLeadingAmountAndUnitFromNameJs(ing.name);
            if (extracted.amount !== null) {
              numericAmount = extracted.amount;
              if (!rawUnit && extracted.unit) rawUnit = extracted.unit;
            }
          }

          const isToTaste = ing.qtyMode === 'to_taste' || String(ing.amount || '').trim() === 'לפי הטעם' || /לפי הטעם/.test(String(ing.name || ''));

          candidates.forEach(cand => {
            if (!cand.shoppingName) return;
            const groupKey = cand.shoppingName.toLowerCase();
            let entry = groups.get(groupKey);
            if (!entry) {
              entry = {
                shoppingName: cand.shoppingName,
                partsByUnit: new Map(),
                originalLines: [],
                requiresUserReview: false,
                conversionNotes: [],
                alternatives: [],
                dietaryConstraints: []
              };
              groups.set(groupKey, entry);
            }
            if (originalLine && !entry.originalLines.includes(originalLine)) entry.originalLines.push(originalLine);
            if (cand.requiresUserReview) entry.requiresUserReview = true;
            if (cand.conversionNote && !entry.conversionNotes.includes(cand.conversionNote)) entry.conversionNotes.push(cand.conversionNote);
            cand.alternatives.forEach(alt => { if (!entry.alternatives.includes(alt)) entry.alternatives.push(alt); });
            cand.dietaryConstraints.forEach(dc => { if (!entry.dietaryConstraints.includes(dc)) entry.dietaryConstraints.push(dc); });

            if (isToTaste || (cand.wasSplitFromCombined && numericAmount === null)) {
              if (!entry.partsByUnit.has('__to_taste__')) entry.partsByUnit.set('__to_taste__', { amount: null, unit: '', toTaste: true });
              return;
            }
            const normUnit = normalizeUnitKeyJs(rawUnit);
            if (numericAmount === null) {
              const uKey = '__unmeasured__:' + normUnit;
              if (!entry.partsByUnit.has(uKey)) entry.partsByUnit.set(uKey, { amount: null, unit: rawUnit, toTaste: false });
              return;
            }
            const scaledAmount = numericAmount * safeMult;
            const unitBucketKey = 'unit:' + normUnit;
            const existingPart = entry.partsByUnit.get(unitBucketKey);
            if (existingPart && existingPart.amount !== null) existingPart.amount += scaledAmount;
            else entry.partsByUnit.set(unitBucketKey, { amount: scaledAmount, unit: rawUnit || normUnit, toTaste: false });
          });
        });
      });

      const prepared = [];
      groups.forEach((entry, key) => {
        const quantityParts = [];
        entry.partsByUnit.forEach(part => {
          if (part.toTaste) quantityParts.push({ amount: null, unit: '', toTaste: true, displayText: 'לפי הטעם' });
          else if (part.amount !== null) {
            const formatted = formatScaledAmountJs(part.amount);
            quantityParts.push({ amount: Math.round(part.amount * 100) / 100, unit: part.unit, toTaste: false, displayText: part.unit ? (formatted + ' ' + part.unit) : formatted });
          } else if (part.unit) {
            quantityParts.push({ amount: null, unit: part.unit, toTaste: false, displayText: part.unit });
          }
        });
        const displayQuantity = quantityParts.map(p => p.displayText).filter(Boolean).join(' + ');
        const measuredPart = quantityParts.find(p => p.amount !== null);

        const altChoice = basketSelectedAlternatives[key];
        const override = basketCustomOverrides[key];
        const effectiveShoppingName = (override && override.shoppingName && override.shoppingName.trim()) || altChoice || entry.shoppingName;
        const effectiveAmount = (override && override.amount !== undefined) ? override.amount : (measuredPart ? measuredPart.amount : null);
        const effectiveUnit = (override && override.unit !== undefined) ? override.unit : (measuredPart ? (normalizeUnitKeyJs(measuredPart.unit) || measuredPart.unit) : '');
        const effectiveDisplayQuantity = (override && (override.amount !== undefined || override.unit !== undefined))
          ? ([effectiveAmount !== null && effectiveAmount !== undefined ? String(effectiveAmount) : '', effectiveUnit || ''].filter(Boolean).join(' ') || displayQuantity)
          : displayQuantity;
        const mergedConstraints = Array.from(new Set(entry.dietaryConstraints.concat(extractDietaryConstraintsJs(effectiveShoppingName))));

        prepared.push({
          id: key,
          shoppingName: effectiveShoppingName,
          searchQuery: effectiveShoppingName,
          displayName: effectiveShoppingName,
          originalRecipeRequirement: entry.originalLines.join(', '),
          originalLines: entry.originalLines,
          displayQuantity: effectiveDisplayQuantity,
          amount: effectiveAmount,
          unit: effectiveUnit,
          requiresUserReview: entry.requiresUserReview,
          conversionNote: entry.conversionNotes.length > 0 ? entry.conversionNotes.join(' | ') : null,
          alternatives: entry.alternatives,
          selectedAlternative: altChoice || (entry.alternatives.length > 0 ? entry.shoppingName : null),
          dietaryConstraints: mergedConstraints
        });
      });
      return prepared;
    }

    function buildCleanStorePasteListJs(items) {
      const seen = new Set();
      const lines = [];
      (items || []).forEach(item => {
        if (!item || item.excluded || item.haveAtHome) return;
        const raw = String(item.shoppingName || item.displayName || item.searchQuery || '').trim();
        if (!raw || isNonPurchasableHouseholdItemJs(raw)) return;
        const dietary = extractDietaryConstraintsJs(raw);
        const stripped = raw
          .replace(/^[\\s•\\-*✓✔☑☐\\[\\]xX\\d.)(]+/g, ' ')
          .replace(/\\([^)]*\\)/g, ' ')
          .replace(/\\[[^\\]]*\\]/g, ' ')
          .replace(/\\s+[—–-]\\s+.*$/, ' ')
          .trim();
        const cleanName = normalizePurchasableTokenStringJs(stripped, dietary);
        if (!cleanName) return;
        const dedupeKey = cleanName.toLowerCase();
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          lines.push(cleanName);
        }
      });
      return lines.join('\\n');
    }

    function buildPersonalReferenceListJs(items) {
      const lines = [];
      (items || []).forEach(item => {
        if (!item || item.excluded || item.haveAtHome) return;
        const name = String(item.shoppingName || item.displayName || '').trim();
        if (!name) return;
        const qty = String(item.displayQuantity || '').trim();
        const orig = String(item.originalRecipeRequirement || '').trim();
        const note = String(item.conversionNote || '').trim();
        let line = '• ' + name;
        if (qty) line += ' — ' + qty;
        if (orig && orig !== name && orig !== (qty + ' ' + name).trim()) line += ' (מתכון: ' + orig + ')';
        if (note) line += ' [' + note + ']';
        lines.push(line);
      });
      return lines.join('\\n');
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

    function isGuestTokenOrUser(u) {
      if (!u) return false;
      const uid = u.userId ? String(u.userId) : '';
      const email = u.email ? String(u.email) : '';
      return uid.startsWith('guest_') || uid.startsWith('usr_guest_') || uid.startsWith('anon_')
        || email.endsWith('@guest.myrecipes.app') || email.endsWith('@guest.myrecipes.local');
    }

    function getRegisteredAuthToken() {
      try {
        const tok = localStorage.getItem('my_recipes_token');
        if (!tok) return null;
        const userRaw = localStorage.getItem('my_recipes_user');
        if (userRaw && isGuestTokenOrUser(JSON.parse(userRaw))) {
          return null;
        }
        const parts = String(tok).split('.');
        if (parts.length === 3) {
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = b64 + '==='.slice((b64.length + 3) % 4);
          const payload = JSON.parse(atob(padded));
          if (isGuestTokenOrUser(payload)) return null;
        }
        return tok;
      } catch (_e) {
        return null;
      }
    }

    async function handleSaveClick(recipeIds, label, forceDuplicate) {
      if (window.__shareSaveInFlight) return;
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

      const targetCount = Array.isArray(recipeIds) && recipeIds.length > 0
        ? recipeIds.length
        : SHARE_DATA.recipes.length;
      const loaderEl = document.getElementById('save-blocking-loader');
      const loaderSub = document.getElementById('save-loader-sub');
      if (loaderSub) {
        loaderSub.textContent = targetCount > 1
          ? ('מעתיק ' + targetCount + ' מתכונים לחשבון שלך... אנא המתינו ואל תלחצו שוב.')
          : 'מעתיק את המתכון לחשבון שלך... אנא המתינו.';
      }
      window.__shareSaveInFlight = true;
      if (loaderEl) loaderEl.classList.add('open');

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
        document.getElementById('save-modal-body').innerHTML = \`
          <p style="font-size:15px;font-weight:700;color:#059669;margin-top:0;">✅ נשמרו \${Number(data.savedCount || 0)} מתכונים לספר שלך בהצלחה!</p>
          <p style="font-size:13px;color:#475569;">המתכונים זמינים עכשיו בספר המתכונים שלך בחינם וללא ניצול מכסה.</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="/app">📖 מעבר לספר המתכונים שלי</a>
            <button class="btn btn-outline" onclick="closeSaveModal()">המשך קריאה כאן</button>
          </div>\`;
        document.getElementById('save-modal').classList.add('open');
      } catch (e) {
        showToast('שגיאת רשת בשמירה, אנא נסו שוב');
      } finally {
        window.__shareSaveInFlight = false;
        if (loaderEl) loaderEl.classList.remove('open');
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

    const PUBLIC_CHAIN_GUIDES_HE = {
      hazi_hinam: {
        menuPathHe: 'קנייה מהירה מרשימה (quickbuy/editor)',
        summaryHe: 'חצי חינם: נפתח ישירות בעורך הקנייה המהירה (quickbuy/editor) — הדביקו את הרשימה (שורה לכל מצרך), בדקו מוצרים וכמויות, והוסיפו לסל בחנות.',
        stepsHe: [
          'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה, ללא כמויות)',
          'החנות נפתחת ישירות בעורך הקנייה המהירה (quickbuy/editor) — הדביקו את הרשימה',
          'בדקו את המוצרים והכמויות שנבחרו ואשרו הוספה לסל בחנות'
        ]
      },
      shufersal: {
        menuPathHe: 'רשימות והזמנות ← הזמנה מהירה',
        summaryHe: 'שופרסל אונליין: באתר שופרסל לחצו על רשימות והזמנות ← הזמנה מהירה, הדביקו את הרשימה פעם אחת, ובדקו את המוצרים והכמויות לפני אישור.',
        stepsHe: [
          'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה)',
          'באתר שופרסל לחצו על רשימות והזמנות ← הזמנה מהירה והדביקו את הרשימה פעם אחת',
          'בדקו את המוצרים והכמויות לפני אישור בחנות'
        ]
      },
      rami_levy: {
        menuPathHe: 'סרגל עליון ← קניה מהירה ← הדבקת הרשימה ← המשך',
        summaryHe: 'רמי לוי באינטרנט: בסרגל העליון לחצו על קניה מהירה, הדביקו את הרשימה ולחצו המשך לבחירת המוצרים והכמויות.',
        stepsHe: [
          'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה)',
          'בסרגל העליון באתר רמי לוי לחצו על קניה מהירה והדביקו את הרשימה',
          'לחצו המשך לבחירת המוצרים והכמויות בחנות'
        ]
      }
    };

    const PUBLIC_QTY_REMINDER_HE = 'שימו לב: כמויות אינן עוברות אוטומטית בהדבקת רשימה, ובחירות המוצרים בחנות הן בגדר הצעה בלבד — יש לבדוק ולאשר מוצרים וכמויות באתר הרשת.';
    const PUBLIC_PROVENANCE_NOTE_HE = 'המחירים הם אומדן מקטלוג השקיפות ואינם כוללים דמי משלוח, מינימום הזמנה, מבצעי מועדון או זמינות במלאי';

    function getActivePublicBasketItems() {
      const recipes = currentBasketIndices.map(i => SHARE_DATA.recipes[i]).filter(Boolean);
      const all = computeBasket(recipes, basketMultiplier);
      const active = all.filter(it => !basketHaveAtHome[it.id] && !basketSkippedIds[it.id]);
      return { recipes, all, active };
    }

    async function triggerPublicBasketCompare() {
      const { active } = getActivePublicBasketItems();
      const seq = ++basketCompareSeq;
      if (active.length === 0) {
        if (cachedMerchantsPayload) cachedMerchantsPayload.basketItems = [];
        renderBasketBody();
        return;
      }
      try {
        const structuredItems = active.map(it => ({
          query: it.shoppingName,
          amount: it.amount,
          unit: it.unit || null,
          dietaryConstraints: it.dietaryConstraints || []
        }));
        const res = await fetch('/api/public/basket-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: structuredItems,
            queries: structuredItems.map(s => s.query)
          })
        });
        const data = await res.json();
        if (seq !== basketCompareSeq) return;
        cachedMerchantsPayload = {
          referralsEnabled: Boolean(data.referralsEnabled),
          defaultDisclosureText: data.defaultDisclosureText || SHARE_DATA.defaultDisclosureText,
          merchants: Array.isArray(data.merchants) ? data.merchants : [],
          mappings: (cachedMerchantsPayload && cachedMerchantsPayload.mappings) || [],
          basketItems: Array.isArray(data.items) ? data.items : []
        };
      } catch {
        if (seq !== basketCompareSeq) return;
        if (!cachedMerchantsPayload) {
          cachedMerchantsPayload = { referralsEnabled: false, merchants: [], mappings: [], basketItems: [] };
        }
      }
      renderBasketBody();
    }

    async function openBasketModal(indices) {
      currentBasketIndices = indices && indices.length ? indices : [activeRecipeIndex];
      basketMultiplier = 1;
      basketSkippedIds = {};
      basketSelfBoughtIds = {};
      basketSelectedAlternatives = {};
      basketCustomOverrides = {};
      basketEditingId = null;
      basketShowPlainBox = false;
      basketHandoffFeedback = null;
      basketListRevision++;
      trackPublicEvent('ingredients_cta_clicked', { count: currentBasketIndices.length });
      document.getElementById('basket-modal').classList.add('open');
      renderBasketBody();
      await triggerPublicBasketCompare();
    }

    function closeBasketModal() { document.getElementById('basket-modal').classList.remove('open'); }

    function setBasketMultiplier(val) {
      basketMultiplier = val;
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    function adjustBasketServings(delta) {
      const recipes = currentBasketIndices.map(i => SHARE_DATA.recipes[i]).filter(Boolean);
      const baseServings = Number(recipes[0] && recipes[0].servings) || 4;
      const currentServings = Math.max(0.5, Math.round(baseServings * basketMultiplier * 10) / 10);
      const step = baseServings >= 2 ? 1 : 0.5;
      const nextServings = Math.max(0.5, Math.round((currentServings + delta * step) * 10) / 10);
      basketMultiplier = nextServings / baseServings;
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    function toggleHaveAtHome(id) {
      basketHaveAtHome[id] = !basketHaveAtHome[id];
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    function toggleSkipBasketItem(id) {
      basketSkippedIds[id] = !basketSkippedIds[id];
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    function toggleSelfBoughtBasketItem(id) {
      basketSelfBoughtIds[id] = !basketSelfBoughtIds[id];
      renderBasketBody();
    }

    function selectBasketAlternative(id, altVal) {
      basketSelectedAlternatives[id] = altVal;
      delete basketCustomOverrides[id];
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    function startEditBasketItem(id) {
      basketEditingId = id;
      renderBasketBody();
    }

    function cancelEditBasketItem() {
      basketEditingId = null;
      renderBasketBody();
    }

    function saveEditBasketItem(id) {
      const nameInp = document.getElementById('public-edit-name-' + id);
      const amtInp = document.getElementById('public-edit-amt-' + id);
      const unitInp = document.getElementById('public-edit-unit-' + id);
      const cleanName = nameInp ? nameInp.value.trim() : '';
      const rawAmt = amtInp ? amtInp.value.trim() : '';
      const parsedAmt = rawAmt ? parseFloat(rawAmt.replace(',', '.')) : null;
      const cleanUnit = unitInp ? unitInp.value.trim() : '';
      basketCustomOverrides[id] = {
        shoppingName: cleanName || undefined,
        amount: (parsedAmt !== null && Number.isFinite(parsedAmt) && parsedAmt > 0) ? parsedAmt : null,
        unit: cleanUnit
      };
      basketEditingId = null;
      basketListRevision++;
      renderBasketBody();
      triggerPublicBasketCompare();
    }

    async function tryCopyTextBrowser(text) {
      if (!text) return false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}
      return false;
    }

    async function copyCleanStoreListOnly() {
      const { active } = getActivePublicBasketItems();
      const text = buildCleanStorePasteListJs(active);
      const ok = await tryCopyTextBrowser(text);
      if (ok) {
        if (selectedMerchantId) {
          basketHandoffFeedback = {
            merchantId: selectedMerchantId,
            listRevision: basketListRevision,
            tone: 'success',
            message: 'הרשימה הנקייה לסופר (' + active.length + ' מצרכים, שורה לכל מצרך ללא כמויות) הועתקה ללוח 📋.',
            fallbackUrl: ''
          };
        }
        showToast('הרשימה הנקייה לסופר הועתקה ללוח 📋');
        trackPublicEvent('shopping_list_confirmed', { count: active.length, method: 'copy_clean_store' });
      } else {
        basketShowPlainBox = true;
        if (selectedMerchantId) {
          basketHandoffFeedback = {
            merchantId: selectedMerchantId,
            listRevision: basketListRevision,
            tone: 'warning',
            message: 'ההעתקה האוטומטית נחסמה בדפדפן זה — העתיקו ידנית מתיבת הטקסט הנקייה שנפתחה למטה.',
            fallbackUrl: ''
          };
        }
        showToast('העתיקו ידנית מתיבת הטקסט הנקייה למטה');
      }
      renderBasketBody();
    }

    async function copyPersonalReferenceListOnly() {
      const { active } = getActivePublicBasketItems();
      const text = buildPersonalReferenceListJs(active);
      const ok = await tryCopyTextBrowser(text);
      if (ok) {
        showToast('הרשימה האישית עם כמויות הועתקה ללוח 📝');
        trackPublicEvent('shopping_list_confirmed', { count: active.length, method: 'copy_personal_reference' });
      } else {
        basketShowPlainBox = true;
        renderBasketBody();
        showToast('ההעתקה האוטומטית נחסמה — ניתן להעתיק מתיבת הטקסט');
      }
    }

    async function triggerBulkStoreHandoff(shouldCopyFirst) {
      const activeMerchant = window.__currentBasketActiveMerchant;
      const { active } = getActivePublicBasketItems();
      if (!activeMerchant) return;

      const win = window.open('about:blank', 'myrecipes_supermarket_tab');
      const popupOpened = Boolean(win);
      if (win) {
        try { win.opener = null; } catch (_e) {}
      }

      let copyOk = false;
      if (shouldCopyFirst) {
        const cleanText = buildCleanStorePasteListJs(active);
        copyOk = await tryCopyTextBrowser(cleanText);
        if (!copyOk) basketShowPlainBox = true;
      }

      try {
        const res = await fetch('/api/affiliate-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId: activeMerchant.id,
            mode: 'bulk_handoff',
            itemCount: active.length,
            shareId: SHARE_DATA.shareId,
            recipeId: window.__currentBasketRecipeId || undefined
          })
        });
        const data = await res.json();
        if (!res.ok || !data.redirectUrl) {
          if (win) win.close();
          basketHandoffFeedback = {
            merchantId: activeMerchant.id,
            listRevision: basketListRevision,
            tone: copyOk ? 'warning' : 'error',
            message: copyOk
              ? ('הרשימה הנקייה הועתקה ללוח 📋, אך קישור החנות אינו זמין כרגע (' + (data.message || 'שגיאה') + ').')
              : (data.message || 'החנות אינה זמינה כרגע'),
            fallbackUrl: ''
          };
          renderBasketBody();
          return;
        }

        if (win) {
          win.location.href = data.redirectUrl;
        }

        if (shouldCopyFirst) {
          if (copyOk && popupOpened) {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'success',
              message: 'הרשימה הנקייה (' + active.length + ' מצרכים) הועתקה ללוח ופתחנו את ' + activeMerchant.displayName + ' ↗. הדביקו את הרשימה בכלי הקנייה המהירה בחנות ובדקו כמויות.',
              fallbackUrl: ''
            };
            showToast('הרשימה הנקייה הועתקה והחנות נפתחה ↗');
          } else if (copyOk && !popupOpened) {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'warning',
              message: 'הרשימה הנקייה הועתקה ללוח 📋, אך הדפדפן חסם פתיחה אוטומטית של החלון — לחצו על הקישור הישיר למטה לפתיחת ' + activeMerchant.displayName + '.',
              fallbackUrl: data.redirectUrl
            };
          } else if (!copyOk && popupOpened) {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'warning',
              message: 'פתחנו את ' + activeMerchant.displayName + ' ↗, אך ההעתקה האוטומטית ללוח נחסמה בדפדפן — העתיקו ידנית מתיבת הטקסט הנקייה למטה.',
              fallbackUrl: ''
            };
          } else {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'error',
              message: 'ההעתקה האוטומטית והחלון החדש נחסמו בדפדפן — העתיקו מתיבת הטקסט למטה ולחצו על הקישור הישיר לפתיחת ' + activeMerchant.displayName + '.',
              fallbackUrl: data.redirectUrl
            };
          }
        } else {
          if (popupOpened) {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'success',
              message: 'פתחנו את ' + activeMerchant.displayName + ' ↗. זכרו להעתיק את הרשימה הנקייה ולהדביק בכלי הקנייה המהירה בחנות.',
              fallbackUrl: ''
            };
          } else {
            basketHandoffFeedback = {
              merchantId: activeMerchant.id,
              listRevision: basketListRevision,
              tone: 'warning',
              message: 'הדפדפן חסם פתיחה אוטומטית של חלון החנות — לחצו על הקישור הישיר למטה לפתיחת ' + activeMerchant.displayName + '.',
              fallbackUrl: data.redirectUrl
            };
          }
        }
        renderBasketBody();
      } catch {
        if (win) win.close();
        basketHandoffFeedback = {
          merchantId: activeMerchant.id,
          listRevision: basketListRevision,
          tone: copyOk ? 'warning' : 'error',
          message: copyOk
            ? 'הרשימה הנקייה הועתקה ללוח 📋, אך אירעה שגיאת רשת בפתיחת קישור החנות.'
            : 'שגיאת רשת בפתיחת קישור לחנות.',
          fallbackUrl: ''
        };
        renderBasketBody();
      }
    }

    async function goToMerchantSearch(merchantId, query, recipeId, productName, sku) {
      trackPublicEvent('ingredient_search_clicked', { merchantId, query });
      const win = window.open('about:blank', 'myrecipes_supermarket_tab');
      if (win) { try { win.opener = null; } catch (_e) {} }
      try {
        const res = await fetch('/api/affiliate-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            mode: 'item_search',
            query,
            productName,
            sku,
            shareId: SHARE_DATA.shareId,
            recipeId
          })
        });
        const data = await res.json();
        if (!res.ok || !data.redirectUrl) {
          if (win) win.close();
          showToast(data.message || 'החנות אינה זמינה כרגע');
          return;
        }
        if (win) {
          win.location.href = data.redirectUrl;
        } else {
          basketHandoffFeedback = {
            merchantId,
            listRevision: basketListRevision,
            tone: 'warning',
            message: 'הדפדפן חסם פתיחה אוטומטית של החיפוש — לחצו על הקישור הישיר למטה.',
            fallbackUrl: data.redirectUrl
          };
          renderBasketBody();
        }
      } catch {
        if (win) win.close();
        showToast('שגיאה בפתיחת קישור לחנות');
      }
    }

    function renderBasketBody() {
      const { recipes, all: items, active: activeItems } = getActivePublicBasketItems();
      const enabledMerchants = ((cachedMerchantsPayload && cachedMerchantsPayload.merchants) || []).filter(m => m.selectable);
      if (selectedMerchantId && !enabledMerchants.some(m => m.id === selectedMerchantId)) {
        selectedMerchantId = null;
      }
      if (!selectedMerchantId && enabledMerchants.length > 0) {
        const completeCheapest = enabledMerchants.find(m => m.isCheapest && (m.isCompleteBasket === true || (m.totalCount > 0 && m.matchedCount === m.totalCount)));
        selectedMerchantId = (completeCheapest || enabledMerchants[0]).id;
      }
      const activeMerchant = enabledMerchants.find(m => m.id === selectedMerchantId) || enabledMerchants[0] || null;
      const mappings = (cachedMerchantsPayload && cachedMerchantsPayload.mappings) || [];
      const basketItems = (cachedMerchantsPayload && cachedMerchantsPayload.basketItems) || [];

      const baseServings = Number(recipes[0] && recipes[0].servings) || 4;
      const scaledServings = Math.max(0.5, Math.round(baseServings * basketMultiplier * 10) / 10);

      const cleanStoreListText = buildCleanStorePasteListJs(activeItems);
      const scopedFeedback = (basketHandoffFeedback && activeMerchant && basketHandoffFeedback.merchantId === activeMerchant.id && basketHandoffFeedback.listRevision === basketListRevision)
        ? basketHandoffFeedback
        : null;

      const computeChainStats = (m) => {
        const totalCount = m.totalCount || activeItems.length;
        let purchSum = 0;
        let consSum = 0;
        let matchedCount = 0;
        const missingNames = [];
        activeItems.forEach(it => {
          const qLower = it.shoppingName.toLowerCase();
          const catRow = basketItems.find(b => String(b.query || '').toLowerCase() === qLower || String(b.normalizedQuery || '').toLowerCase() === qLower);
          const catMatch = (catRow && catRow.matches) ? catRow.matches[m.id] : null;
          if (catMatch && typeof catMatch.price === 'number' && catMatch.price > 0) {
            matchedCount++;
            purchSum += (typeof catMatch.purchasableCost === 'number' && catMatch.purchasableCost > 0) ? catMatch.purchasableCost : catMatch.price;
            consSum += (typeof catMatch.consumptionCost === 'number' && catMatch.consumptionCost > 0) ? catMatch.consumptionCost : catMatch.price;
          } else {
            missingNames.push(it.shoppingName);
          }
        });
        const finalMatched = matchedCount > 0 ? matchedCount : (m.matchedCount || 0);
        const finalMissing = (Array.isArray(m.missingItems) && m.missingItems.length > 0) ? m.missingItems : missingNames;
        const isComplete = m.isCompleteBasket !== undefined ? Boolean(m.isCompleteBasket) : (totalCount > 0 && finalMatched === totalCount && finalMissing.length === 0);
        const purchasableTotal = (typeof m.purchasableTotal === 'number' && m.purchasableTotal > 0) ? m.purchasableTotal : (purchSum > 0 ? Math.round(purchSum * 100) / 100 : (m.estimatedTotal || 0));
        const consumptionTotal = (typeof m.consumptionTotal === 'number' && m.consumptionTotal > 0) ? m.consumptionTotal : (consSum > 0 ? Math.round(consSum * 100) / 100 : purchasableTotal);
        return { totalCount, matchedCount: finalMatched, missingItems: finalMissing, isCompleteBasket: isComplete, purchasableTotal, consumptionTotal };
      };

      const activeStats = activeMerchant ? computeChainStats(activeMerchant) : null;
      const merchantCardsHtml = enabledMerchants.length > 0
        ? '<div style="margin:10px 0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;">' +
            '<div style="font-size:13px;font-weight:800;color:#064e3b;">1. בחירת רשת שיווק:</div>' +
            '<button type="button" onclick="basketShowChainDetails=!basketShowChainDetails;renderBasketBody();" style="background:transparent;border:none;color:#047857;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;padding:2px 4px;text-decoration:underline;">' +
              (basketShowChainDetails ? 'הסתר מידע נוסף ▴' : 'למידע נוסף ▾') +
            '</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(' + Math.min(3, enabledMerchants.length) + ',minmax(0,1fr));gap:6px;">' +
          enabledMerchants.map(m => {
            const isSel = activeMerchant && activeMerchant.id === m.id;
            const st = computeChainStats(m);
            const showCheapest = m.isCheapest && st.isCompleteBasket;
            const priceLine = st.matchedCount > 0
              ? '<span style="font-size:13px;font-weight:900;color:' + (isSel ? '#6ee7b7' : '#059669') + ';">~₪' + st.purchasableTotal.toFixed(0) + '</span>' +
                '<span style="font-size:10px;font-weight:700;opacity:0.88;">' + (showCheapest ? '🏆 הכי משתלם' : (st.isCompleteBasket ? (st.matchedCount + '/' + st.totalCount + ' זוהו') : ('חלקי ' + st.matchedCount + '/' + st.totalCount))) + '</span>'
              : '<span style="font-size:11px;opacity:0.82;">העברה מהירה</span>';
            return '<button type="button" data-select-merchant="' + esc(m.id) + '" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;width:100%;min-width:0;padding:8px 5px;border-radius:11px;cursor:pointer;' +
              (isSel ? 'background:#064e3b;color:#fff;border:2px solid #059669;box-shadow:0 2px 6px rgba(5,150,105,0.22);' : 'background:#fff;color:#0f172a;border:1.5px solid #cbd5e1;') + '">' +
              '<span style="font-size:13px;font-weight:900;line-height:1.2;">' + (isSel ? '✓ ' : '') + esc(m.displayName) + '</span>' +
              priceLine +
            '</button>';
          }).join('') +
          '</div>' +
          (basketShowChainDetails
            ? '<div style="margin-top:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;font-size:12px;color:#334155;line-height:1.5;">' +
              (activeMerchant && activeStats
                ? '<div style="font-weight:900;color:#0f172a;margin-bottom:4px;">פירוט אומדן עבור ' + esc(activeMerchant.displayName) + ':</div>' +
                  (activeStats.matchedCount > 0
                    ? '<div>• <strong>אומדן קנייה בקופה:</strong> ~₪' + activeStats.purchasableTotal.toFixed(2) + ' (' + activeStats.matchedCount + ' מתוך ' + activeStats.totalCount + ' מצרכים זוהו)</div>' +
                      '<div>• <strong>עלות יחסית למתכון:</strong> ~₪' + activeStats.consumptionTotal.toFixed(2) + '</div>'
                    : '<div>• זמין להעברת רשימה מרוכזת ישירות לאתר הרשת.</div>') +
                  (activeStats.missingItems.length > 0 ? '<div style="color:#b45309;font-weight:700;margin-top:3px;">• חסר באומדן (לא נכלל בסכום): ' + esc(activeStats.missingItems.join(', ')) + '</div>' : '') +
                  '<hr style="border:none;border-top:1px solid #e2e8f0;margin:7px 0;">'
                : '') +
              '<div style="font-size:11px;color:#475569;">ℹ️ ' + esc(PUBLIC_PROVENANCE_NOTE_HE) + ' • 🔗 ' + esc((activeMerchant && activeMerchant.disclosureText) || SHARE_DATA.defaultDisclosureText) + '</div>' +
              '</div>'
            : '') +
          '</div>'
        : '<div class="disclosure">ℹ️ ' + esc(PUBLIC_PROVENANCE_NOTE_HE) + ' • חיפוש ישיר בחנויות אינו פעיל כרגע — ניתן להעתיק את הרשימה הנקייה למטה.</div>';

      const guide = activeMerchant ? (PUBLIC_CHAIN_GUIDES_HE[activeMerchant.id] || {
        menuPathHe: activeMerchant.menuPathHe || 'קנייה מהירה מרשימה',
        summaryHe: activeMerchant.displayName + ': פתחו את כלי הקנייה המהירה באתר הרשת, הדביקו את הרשימה הנקייה ובדקו מוצרים וכמויות.',
        stepsHe: activeMerchant.instructionsStepsHe || []
      }) : null;

      const handoffCardHtml = activeMerchant ? \`
        <div style="background:#ecfdf5;border:1.5px solid #10b981;border-radius:14px;padding:11px 12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <div style="font-size:14px;font-weight:900;color:#065f46;">2. העברה ל-\${esc(activeMerchant.displayName)}</div>
            \${guide ? '<button type="button" onclick="basketShowHandoffDetails=!basketShowHandoffDetails;renderBasketBody();" style="background:transparent;border:none;color:#047857;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;padding:2px 4px;text-decoration:underline;">' + (basketShowHandoffDetails ? 'הסתר הסבר מפורט ▴' : 'להסבר מפורט ▾') + '</button>' : ''}
          </div>
          <div style="font-size:12px;color:#0f172a;line-height:1.4;margin-bottom:9px;">
            העתיקו את הרשימה הנקייה בלחיצה אחת והדביקו בכלי הקנייה המהירה של \${esc(activeMerchant.displayName)}.
          </div>
          \${(guide && basketShowHandoffDetails) ? \`
            <div style="background:#fff;border:1px solid #a7f3d0;border-radius:10px;padding:9px 10px;margin-bottom:10px;font-size:12px;line-height:1.5;">
              <div style="font-weight:900;color:#047857;margin-bottom:3px;">🧭 נתיב בחנות: \${esc(guide.menuPathHe)}</div>
              <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">\${esc(guide.summaryHe)}</div>
              <ol style="margin:0 0 6px;padding-right:18px;color:#334155;font-size:11px;">
                \${(guide.stepsHe || []).map(st => '<li>' + esc(st) + '</li>').join('')}
              </ol>
              <div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:6px;padding:6px 8px;font-size:11px;font-weight:800;">
                ⚠️ \${esc(PUBLIC_QTY_REMINDER_HE)}
              </div>
            </div>
          \` : ''}

          <button type="button" class="btn btn-primary" style="width:100%;padding:12px 10px;font-size:14px;font-weight:900;margin-bottom:7px;white-space:normal;" onclick="triggerBulkStoreHandoff(true)" \${activeItems.length === 0 ? 'disabled' : ''}>
            📋 העתק רשימה נקייה ופתח את \${esc(activeMerchant.displayName)} ↗
          </button>

          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline" style="flex:1;min-width:110px;padding:7px;font-size:12px;white-space:normal;" onclick="copyCleanStoreListOnly()" \${activeItems.length === 0 ? 'disabled' : ''}>
              📋 העתק רשימה בלבד
            </button>
            <button type="button" class="btn btn-outline" style="flex:1;min-width:110px;padding:7px;font-size:12px;white-space:normal;" onclick="triggerBulkStoreHandoff(false)">
              🏪 פתח חנות בלבד
            </button>
            <button type="button" class="btn btn-outline" style="padding:7px 9px;font-size:11px;" onclick="basketShowPlainBox=!basketShowPlainBox;renderBasketBody();">
              \${basketShowPlainBox ? 'הסתר טקסט ▴' : 'תיבת טקסט ▾'}
            </button>
          </div>

          \${scopedFeedback ? \`
            <div style="margin-top:8px;padding:9px 10px;border-radius:9px;font-size:12px;font-weight:700;background:\${scopedFeedback.tone === 'success' ? '#d1fae5' : (scopedFeedback.tone === 'warning' ? '#fef3c7' : '#fee2e2')};border:1px solid \${scopedFeedback.tone === 'success' ? '#059669' : (scopedFeedback.tone === 'warning' ? '#d97706' : '#dc2626')};color:#0f172a;">
              <div>\${esc(scopedFeedback.message)}</div>
              \${scopedFeedback.fallbackUrl ? '<a href="' + esc(scopedFeedback.fallbackUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top:6px;width:100%;text-decoration:none;font-size:12px;">לחצו כאן לפתיחת ' + esc(activeMerchant.displayName) + ' ↗</a>' : ''}
            </div>
          \` : ''}

          \${basketShowPlainBox ? \`
            <div style="margin-top:8px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:8px;">
              <div style="font-size:11px;font-weight:800;color:#334155;margin-bottom:4px;">רשימה נקייה להדבקה בסופר (מצרך אחד בכל שורה, ללא כמויות):</div>
              <textarea readonly rows="5" onclick="this.select()" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:13px;background:#f8fafc;color:#0f172a;">\${esc(cleanStoreListText)}</textarea>
            </div>
          \` : ''}
        </div>
      \` : \`
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button type="button" class="btn btn-primary" style="flex:1;padding:9px 10px;font-size:12px;" onclick="copyCleanStoreListOnly()" \${activeItems.length === 0 ? 'disabled' : ''}>📋 העתק רשימה לסופר בלבד</button>
          <button type="button" class="btn btn-outline" style="flex:1;padding:9px 10px;font-size:12px;" onclick="copyPersonalReferenceListOnly()" \${activeItems.length === 0 ? 'disabled' : ''}>📝 העתק רשימה עם כמויות (לשימוש אישי)</button>
        </div>
      \`;

      const rowsHtml = items.map((item, itemIdx) => {
        const have = Boolean(basketHaveAtHome[item.id]);
        const skipped = Boolean(basketSkippedIds[item.id]);
        const selfBought = Boolean(basketSelfBoughtIds[item.id]);
        const isExcluded = have || skipped;
        const isEditing = basketEditingId === item.id;
        const qLower = item.shoppingName.toLowerCase();
        const skuMatch = activeMerchant ? mappings.find(mp => mp.merchantId === activeMerchant.id && mp.normalizedName.toLowerCase() === qLower) : null;
        const catRow = activeMerchant ? basketItems.find(b => String(b.query || '').toLowerCase() === qLower || String(b.normalizedQuery || '').toLowerCase() === qLower) : null;
        const catMatch = (catRow && catRow.matches && activeMerchant) ? catRow.matches[activeMerchant.id] : null;
        const isHighConf = catMatch ? (catMatch.confidence === undefined || catMatch.confidence >= 80) : Boolean(skuMatch);
        const prodTitle = isHighConf ? (catMatch ? catMatch.productName : (skuMatch ? skuMatch.productName : '')) : '';
        const prodSku = isHighConf ? (catMatch ? catMatch.itemCode : (skuMatch ? skuMatch.sku : '')) : '';
        item.matchedProductName = prodTitle || '';
        item.matchedSku = prodSku || '';
        const prodPrice = catMatch && catMatch.price ? (' • ' + (catMatch.pricingBasisLabel || ('₪' + Number(catMatch.price).toFixed(2)))) : '';
        const reviewBadge = item.conversionNote
          ? (item.shoppingName.startsWith('ביצים') ? '⚠️ הומר מחלמונים לביצים — בדקו כמות מארז' : ('⚠️ ' + item.conversionNote))
          : '';

        const altPillsHtml = (Array.isArray(item.alternatives) && item.alternatives.length >= 2 && !isExcluded)
          ? '<div style="margin-top:6px;"><div style="font-size:11px;font-weight:800;color:#047857;margin-bottom:3px;">בחרו חלופה לקנייה:</div><div style="display:flex;gap:5px;flex-wrap:wrap;">' +
            item.alternatives.map(alt => {
              const activeAlt = item.shoppingName === alt;
              return '<button type="button" class="btn ' + (activeAlt ? 'btn-primary' : 'btn-outline') + '" style="padding:4px 9px;font-size:11px;border-radius:99px;" data-basket-alt-id="' + esc(item.id) + '" data-basket-alt-val="' + esc(alt) + '">' + (activeAlt ? '✓ ' : '') + esc(alt) + '</button>';
            }).join('') +
            '</div></div>'
          : '';

        const editBoxHtml = isEditing
          ? '<div style="margin-top:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px;">' +
              '<div style="font-size:11px;font-weight:800;margin-bottom:4px;">עריכת שם מצרך לסופר וכמות:</div>' +
              '<input type="text" id="public-edit-name-' + esc(item.id) + '" value="' + esc(item.shoppingName) + '" placeholder="שם מצרך לסופר" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:6px;font-size:12px;" />' +
              '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
                '<input type="text" id="public-edit-amt-' + esc(item.id) + '" value="' + esc(item.amount !== null && item.amount !== undefined ? item.amount : '') + '" placeholder="כמות" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />' +
                '<input type="text" id="public-edit-unit-' + esc(item.id) + '" value="' + esc(item.unit || '') + '" placeholder="יחידה" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />' +
              '</div>' +
              '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
                '<button type="button" class="btn btn-outline" style="padding:4px 9px;font-size:11px;" onclick="cancelEditBasketItem()">ביטול</button>' +
                '<button type="button" class="btn btn-primary" style="padding:4px 9px;font-size:11px;" data-save-edit-id="' + esc(item.id) + '">שמור</button>' +
              '</div>' +
            '</div>'
          : '';

        return \`
          <div style="padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;background:\${isExcluded ? '#f8fafc' : '#fff'};opacity:\${isExcluded ? '0.6' : '1'};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:14px;\${isExcluded ? 'text-decoration:line-through;' : ''}">
                  \${esc(item.shoppingName)}\${item.displayQuantity ? ' • <span style="font-weight:700;color:#047857;">' + esc(item.displayQuantity) + '</span>' : ''}
                </div>
                \${item.originalRecipeRequirement ? '<div style="font-size:11px;color:#64748b;margin-top:2px;">דרישת המתכון: ' + esc(item.originalRecipeRequirement) + '</div>' : ''}
                \${(item.dietaryConstraints && item.dietaryConstraints.length > 0) ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">' + item.dietaryConstraints.map(dc => '<span style="background:#ede9fe;color:#5b21b6;font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;">🛡️ ' + esc(dc) + '</span>').join('') + '</div>' : ''}
                \${reviewBadge ? '<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:11px;font-weight:800;padding:3px 7px;border-radius:6px;margin-top:4px;display:inline-block;">' + esc(reviewBadge) + '</div>' : ''}
                \${altPillsHtml}
                \${editBoxHtml}
                <div style="font-size:11px;color:#059669;font-weight:700;margin-top:4px;">
                  \${have ? 'סומן: יש בבית 🏠 (לא ייכלל ברשימה לסופר)' : (skipped ? 'דולג בהעברה זו ⏭️ (לא ייכלל ברשימה לסופר)' : (prodTitle ? '📦 התאמה בקטלוג: ' + esc(prodTitle) + esc(prodPrice) : 'לחיפוש ברשת: ' + esc(item.shoppingName)))}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;">
              <button type="button" class="btn \${have ? 'btn-primary' : 'btn-outline'}" style="padding:4px 8px;font-size:11px;" data-toggle-home-idx="\${itemIdx}">\${have ? '✓ יש בבית 🏠' : 'יש בבית 🏠'}</button>
              <button type="button" class="btn \${skipped ? 'btn-primary' : 'btn-outline'}" style="padding:4px 8px;font-size:11px;" data-skip-basket-idx="\${itemIdx}">\${skipped ? 'בטל דילוג ↩️' : 'דלג'}</button>
              \${!isExcluded ? '<button type="button" class="btn btn-outline" style="padding:4px 8px;font-size:11px;" data-edit-basket-idx="' + itemIdx + '">✏️ עריכת שם/כמות</button>' : ''}
              \${!isExcluded ? '<button type="button" class="btn ' + (selfBought ? 'btn-primary' : 'btn-outline') + '" style="padding:4px 8px;font-size:11px;" data-self-bought-idx="' + itemIdx + '">' + (selfBought ? '✓ סומן שנקנה ברשימה שלי' : 'סמן שנקנה ברשימה שלי') + '</button>' : ''}
              \${activeMerchant && !isExcluded ? '<button type="button" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;" data-merchant-search-idx="' + itemIdx + '">🔍 חפש בחנות</button>' : ''}
            </div>
          </div>\`;
      }).join('');

      window.__currentBasketItems = items;
      window.__currentBasketActiveMerchant = activeMerchant;
      window.__currentBasketRecipeId = recipes[0]?.id || '';

      document.getElementById('basket-body').innerHTML = \`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;margin-bottom:10px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:800;color:#0f172a;">🍽️ כמות מנות למתכון (מעדכן כמויות ואומדן):</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:14px;font-weight:900;" onclick="adjustBasketServings(-1)">-</button>
            <span style="font-size:13px;font-weight:900;min-width:52px;text-align:center;">\${scaledServings} מנות</span>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:14px;font-weight:900;" onclick="adjustBasketServings(1)">+</button>
          </div>
        </div>
        \${merchantCardsHtml}
        \${handoffCardHtml}
        <div style="font-size:13px;font-weight:800;color:#064e3b;margin-bottom:6px;">3. בדיקת מצרכים, חלופות וכמויות לפני העברה (\${activeItems.length} פעילים מתוך \${items.length}):</div>
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
      const altBtn = ev.target.closest('[data-basket-alt-id]');
      if (altBtn) {
        selectBasketAlternative(altBtn.dataset.basketAltId, altBtn.dataset.basketAltVal);
        return;
      }
      const saveEditBtn = ev.target.closest('[data-save-edit-id]');
      if (saveEditBtn) {
        saveEditBasketItem(saveEditBtn.dataset.saveEditId);
        return;
      }
      const homeBtn = ev.target.closest('[data-toggle-home-idx]');
      if (homeBtn && window.__currentBasketItems) {
        const item = window.__currentBasketItems[Number(homeBtn.dataset.toggleHomeIdx)];
        if (item) toggleHaveAtHome(item.id);
        return;
      }
      const skipBtn = ev.target.closest('[data-skip-basket-idx]');
      if (skipBtn && window.__currentBasketItems) {
        const item = window.__currentBasketItems[Number(skipBtn.dataset.skipBasketIdx)];
        if (item) toggleSkipBasketItem(item.id);
        return;
      }
      const editBtn = ev.target.closest('[data-edit-basket-idx]');
      if (editBtn && window.__currentBasketItems) {
        const item = window.__currentBasketItems[Number(editBtn.dataset.editBasketIdx)];
        if (item) startEditBasketItem(item.id);
        return;
      }
      const selfBoughtBtn = ev.target.closest('[data-self-bought-idx]');
      if (selfBoughtBtn && window.__currentBasketItems) {
        const item = window.__currentBasketItems[Number(selfBoughtBtn.dataset.selfBoughtIdx)];
        if (item) toggleSelfBoughtBasketItem(item.id);
        return;
      }
      const searchBtn = ev.target.closest('[data-merchant-search-idx]');
      if (searchBtn && window.__currentBasketActiveMerchant) {
        const item = window.__currentBasketItems[Number(searchBtn.dataset.merchantSearchIdx)];
        if (item) goToMerchantSearch(window.__currentBasketActiveMerchant.id, item.shoppingName || item.searchQuery, window.__currentBasketRecipeId, item.matchedProductName || undefined, item.matchedSku || undefined);
        return;
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
