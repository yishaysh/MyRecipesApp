import { CollectionRecord, CuratedOwnerSettings, CuratedRecipeRecord } from '../services/curated-collections.service.js';

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPublicCuratedRecipeHtml(params: {
  curated: CuratedRecipeRecord;
  collections: CollectionRecord[];
  branding: CuratedOwnerSettings;
  canonicalUrl: string;
}): string {
  const { curated, collections, branding, canonicalUrl } = params;
  const r = curated.recipePayload || {};
  const title = r.title || 'מתכון נבחר';
  const desc = r.description || `${title} — מתכון מומלץ מתוך ${branding.ownerLogoText}`;
  const ogImage = curated.coverImage || r.imageUrl || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1200&auto=format&fit=crop';
  const ingredients: any[] = Array.isArray(r.ingredients) ? r.ingredients : [];
  const instructions: any[] = Array.isArray(r.instructions) ? r.instructions : [];
  const openAppUrl = `/app?curatedRecipe=${encodeURIComponent(curated.slug)}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | ${esc(branding.ownerLogoText)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)} — ${esc(branding.ownerLogoText)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f9f5; color: #0f172a; direction: rtl; line-height: 1.6; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px 60px; }
    .brand-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(5,150,105,0.12); color: #065f46; padding: 5px 12px; border-radius: 999px; font-weight: 800; font-size: 0.84rem; margin-bottom: 12px; }
    .hero { width: 100%; max-height: 360px; object-fit: cover; border-radius: 18px; margin-bottom: 16px; border: 1px solid #d1fae5; }
    h1 { font-size: 1.8rem; color: #064e3b; margin-bottom: 8px; }
    .desc { color: #475569; margin-bottom: 14px; font-size: 0.98rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
    .chip { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; text-decoration: none; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 0.95rem; }
    .btn-primary { background: #059669; color: #fff; flex: 1; }
    .btn-secondary { background: #fff; color: #065f46; border: 1.5px solid #059669; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 16px; }
    h2 { font-size: 1.15rem; color: #065f46; margin-bottom: 10px; }
    ul, ol { padding-right: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand-pill">${esc(branding.ownerBadgeEmoji)} ${esc(branding.ownerLogoText)}</div>
    ${ogImage ? `<img class="hero" src="${esc(ogImage)}" alt="${esc(title)}">` : ''}
    <h1>${esc(title)}</h1>
    <p class="desc">${esc(desc)}</p>
    ${collections.length > 0 ? `<div class="chips">${collections.map((c) => `<a class="chip" href="/c/${esc(c.slug)}">${esc(c.icon)} ${esc(c.name)}</a>`).join('')}</div>` : ''}
    <div class="cta-row">
      <a class="btn btn-primary" href="${esc(openAppUrl)}">💾 פתח ושמור לספר המתכונים שלי</a>
      <a class="btn btn-secondary" href="/app">📖 לכל המתכונים</a>
    </div>
    <div class="card">
      <h2>🛒 מצרכים (${ingredients.length})</h2>
      <ul>
        ${ingredients.map((ing) => `<li>${esc(ing.amount != null ? `${ing.amount} ${ing.unit || ''} ` : (ing.unit ? `${ing.unit} ` : ''))}${esc(ing.name || ing.originalText || '')}</li>`).join('')}
      </ul>
    </div>
    <div class="card">
      <h2>👩‍🍳 הוראות הכנה (${instructions.length})</h2>
      <ol>
        ${instructions.map((st) => `<li>${esc(st.instruction || '')}</li>`).join('')}
      </ol>
    </div>
  </div>
</body>
</html>`;
}

export function renderPublicCollectionHtml(params: {
  collection: CollectionRecord;
  recipes: CuratedRecipeRecord[];
  branding: CuratedOwnerSettings;
  canonicalUrl: string;
}): string {
  const { collection, recipes, branding, canonicalUrl } = params;
  const subtitle = collection.subtitle || `${recipes.length} מתכונים נבחרים`;
  const ogDesc = collection.subtitle
    ? `${collection.subtitle} • ${recipes.length} מתכונים מתוך ${branding.ownerLogoText}`
    : `${recipes.length} מתכונים מתוך ${branding.ownerLogoText}`;
  const ogImage = collection.coverImage || recipes[0]?.coverImage || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1200&auto=format&fit=crop';
  const openAppUrl = `/app?collection=${encodeURIComponent(collection.slug)}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(collection.name)} — ${esc(subtitle)} | ${esc(branding.ownerLogoText)}</title>
  <meta name="description" content="${esc(ogDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(collection.icon)} ${esc(collection.name)} — ${esc(subtitle)}">
  <meta property="og:description" content="${esc(ogDesc)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f9f5; color: #0f172a; direction: rtl; line-height: 1.5; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 20px 16px 60px; }
    .hero-card { border-radius: 20px; padding: 26px 22px; color: #fff; background: ${esc(collection.colorGradient)}; margin-bottom: 20px; }
    .hero-icon { font-size: 2.6rem; margin-bottom: 8px; }
    .hero-card h1 { font-size: 1.85rem; margin-bottom: 4px; }
    .hero-sub { font-size: 1rem; opacity: 0.92; margin-bottom: 14px; }
    .hero-btn { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #064e3b; padding: 10px 18px; border-radius: 12px; font-weight: 800; text-decoration: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .rcard { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
    .rcard img { width: 100%; height: 150px; object-fit: cover; }
    .rcard-body { padding: 12px; }
    .rcard-title { font-weight: 800; font-size: 0.96rem; color: #064e3b; margin-bottom: 4px; }
    .rcard-meta { font-size: 0.78rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero-card">
      <div class="hero-icon">${esc(collection.icon)}</div>
      <h1>${esc(collection.name)}</h1>
      <div class="hero-sub">${esc(subtitle)} • ${recipes.length} מתכונים</div>
      <a class="hero-btn" href="${esc(openAppUrl)}">📖 פתח את הקבוצה באפליקציה</a>
    </div>
    <div class="grid">
      ${recipes.map((rec) => `
        <a class="rcard" href="/r/${esc(rec.slug)}">
          <img src="${esc(rec.coverImage || rec.recipePayload?.imageUrl || ogImage)}" alt="${esc(rec.recipePayload?.title || '')}">
          <div class="rcard-body">
            <div class="rcard-title">${esc(rec.recipePayload?.title || 'מתכון')}</div>
            <div class="rcard-meta">⏱️ ${esc(rec.recipePayload?.totalTimeMinutes ? rec.recipePayload.totalTimeMinutes + " דק'" : '--')}</div>
          </div>
        </a>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}
