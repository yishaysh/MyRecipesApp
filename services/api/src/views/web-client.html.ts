export function getWebClientHtml(): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>ספר המתכונים שלי</title>
  
  <!-- iOS Safari PWA & Add to Home Screen Support -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ספר המתכונים">
  <meta name="theme-color" content="#064e3b">
  <link rel="apple-touch-icon" href="https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/apple-touch-icon.png">
  <link rel="apple-touch-icon-precomposed" href="https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/apple-touch-icon.png">
  <link rel="icon" type="image/png" href="https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/favicon.png">

  <!-- Google Font: Heebo -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    :root {
      --primary: #064e3b;
      --primary-light: #047857;
      --accent: #059669;
      --accent-hover: #10b981;
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-card: #f1f5f9;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --danger: #ef4444;
      --warning: #f59e0b;
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: 'Heebo', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      direction: rtl;
      text-align: right;
    }

    /* Header */
    header {
      background: linear-gradient(135deg, #064e3b 0%, #047857 100%);
      color: #ffffff;
      padding: 16px 20px;
      padding-top: max(16px, env(safe-area-inset-top));
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(6, 78, 59, 0.2);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      font-size: 26px;
      background: rgba(255, 255, 255, 0.2);
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .brand-title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 0.75rem;
      opacity: 0.85;
      font-weight: 400;
    }

    .badge-status {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #34d399;
      border-radius: 50%;
      box-shadow: 0 0 8px #34d399;
    }

    /* iOS Tip Banner */
    .ios-banner {
      background: #fef3c7;
      border-bottom: 1px solid #fde68a;
      color: #92400e;
      padding: 10px 16px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .ios-banner-text {
      flex: 1;
      line-height: 1.4;
    }

    .ios-banner-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: #92400e;
      padding: 4px 8px;
    }

    /* Navigation Tabs */
    nav.tab-bar {
      display: flex;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 6px 12px;
      overflow-x: auto;
      gap: 6px;
      position: sticky;
      top: 76px;
      z-index: 90;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .tab-btn:hover {
      background: var(--surface-card);
      color: var(--text);
    }

    .tab-btn.active {
      background: rgba(5, 150, 105, 0.12);
      border-color: rgba(5, 150, 105, 0.3);
      color: var(--accent);
    }

    /* Main Container */
    main {
      flex: 1;
      max-width: 850px;
      width: 100%;
      margin: 0 auto;
      padding: 16px;
      padding-bottom: max(32px, env(safe-area-inset-bottom));
    }

    .panel { display: none; }
    .panel.active { display: block; animation: fadeIn 0.25s ease; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
    }

    .title {
      font-size: 1.35rem;
      font-weight: 800;
      margin-bottom: 6px;
      color: var(--primary);
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 18px;
    }

    /* URL Input & Extract */
    .input-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    @media (min-width: 640px) {
      .input-row {
        flex-direction: row;
      }
    }

    input[type="text"] {
      flex: 1;
      background: var(--surface-card);
      border: 1.5px solid var(--border);
      color: var(--text);
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 0.95rem;
      outline: none;
      direction: ltr;
      text-align: left;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus {
      border-color: var(--accent);
      background: #ffffff;
    }

    .btn-primary {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      border: none;
      padding: 14px 24px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
      font-family: inherit;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }

    .btn-primary:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    /* Presets */
    .presets-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .preset-card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 12px 14px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .preset-card:hover {
      border-color: var(--accent);
      background: #ffffff;
      transform: translateY(-2px);
    }

    .preset-card-title {
      font-weight: 700;
      font-size: 0.9rem;
      margin-bottom: 4px;
      color: var(--text);
    }

    .preset-card-url {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      direction: ltr;
      text-align: left;
    }

    /* Stepper & Progress */
    .progress-box {
      background: rgba(5, 150, 105, 0.08);
      border: 1.5px solid rgba(5, 150, 105, 0.3);
      padding: 18px;
      border-radius: 14px;
      margin-bottom: 20px;
      display: none;
    }

    .progress-title {
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1rem;
    }

    .stepper {
      display: flex;
      align-items: center;
      margin-top: 14px;
      padding: 0 6px;
    }

    .step-node {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--surface-card);
      border: 2px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .step-node.active {
      border-color: var(--accent);
      background: var(--accent);
      color: #ffffff;
    }

    .step-line {
      flex: 1;
      height: 3px;
      background: var(--border);
    }

    .step-line.active { background: var(--accent); }

    /* Recipe Viewer */
    .recipe-header {
      margin-bottom: 16px;
    }

    .badge-category {
      background: #e0e7ff;
      color: #3730a3;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 8px;
    }

    .meta-pills {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: var(--surface-card);
      padding: 12px 16px;
      border-radius: 14px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }

    .meta-pill-item {
      text-align: center;
    }

    .meta-pill-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .meta-pill-val {
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--primary);
    }

    /* Servings Scaler */
    .scaler-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 12px 18px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .scaler-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      width: 36px;
      height: 36px;
      border-radius: 10px;
      font-size: 1.2rem;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }

    .scaler-btn:hover { background: var(--border); }

    /* Checklist & Items */
    .item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .item-row.checked {
      opacity: 0.45;
      text-decoration: line-through;
      background: #f8fafc;
    }

    .checkbox {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 2px solid var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: white;
      flex-shrink: 0;
    }

    .item-row.checked .checkbox {
      background: var(--accent);
      border-color: var(--accent);
    }

    /* Recipe Hero Image Banner */
    .recipe-hero-container {
      position: relative;
      width: 100%;
      height: 240px;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 16px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.12);
      background: #e2e8f0;
    }

    .recipe-hero-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    .recipe-hero-overlay {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 2;
    }

    .recipe-hero-badge {
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }

    /* Saved Recipe Card Items */
    .recipe-card-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 16px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      position: relative;
    }

    .recipe-card-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.08);
      border-color: rgba(6, 78, 59, 0.25);
    }

    .recipe-card-item:active {
      transform: scale(0.985);
    }

    .recipe-card-thumb-wrap {
      width: 82px;
      height: 82px;
      min-width: 82px;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      background: #e2e8f0;
      flex-shrink: 0;
    }

    .recipe-card-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .recipe-card-platform-badge {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(0,0,0,0.65);
      color: #ffffff;
      font-size: 0.62rem;
      padding: 1px 5px;
      border-radius: 5px;
      backdrop-filter: blur(4px);
      font-weight: 700;
    }

    .recipe-card-info {
      flex: 1;
      min-width: 0;
    }

    .recipe-card-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1.35;
      margin: 4px 0 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .recipe-card-meta {
      display: flex;
      flex-wrap: wrap;
      row-gap: 4px;
      gap: 10px;
      align-items: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 500;
    }

    .recipe-card-arrow {
      color: var(--accent);
      font-size: 1.4rem;
      font-weight: 800;
      padding: 0 4px;
      opacity: 0.7;
    }

    .recipe-card-delete {
      background: transparent;
      border: none;
      color: #9ca3af;
      padding: 8px;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .recipe-card-delete:hover {
      color: var(--danger);
      background: #fee2e2;
    }

    .step-card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .step-badge {
      background: var(--primary);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .timer-btn {
      background: var(--surface);
      border: 1px solid var(--warning);
      color: #b45309;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
    }

    .timer-btn.active {
      background: var(--warning);
      color: #ffffff;
      animation: pulse 1s infinite alternate;
    }

    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.04); }
    }

    .category-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--primary);
      margin: 18px 0 8px;
    }

    .action-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .action-btn {
      background: var(--surface-card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px 16px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: var(--border);
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-icon">🍳</div>
      <div>
        <div class="brand-title">ספר המתכונים שלי</div>
        <div class="brand-sub">חילוץ ושמירת מתכונים חכמה עם AI</div>
      </div>
    </div>
    <div class="badge-status">
      <span class="status-dot"></span>
      פעיל
    </div>
  </header>

  <div id="ios-tip" class="ios-banner">
    <div class="ios-banner-text">
      📱 <strong>טיפ לאייפון:</strong> לחצי על כפתור השיתוף בתחתית הספארי <strong>[↑]</strong> ובחרי <strong>"הוסף למסך הבית"</strong> לשימוש כאפליקציה במסך מלא!
    </div>
    <button class="ios-banner-close" onclick="document.getElementById('ios-tip').style.display='none'">✕</button>
  </div>

  <nav class="tab-bar">
    <button class="tab-btn active" onclick="switchTab('extract')">✨ חילוץ מתכון</button>
    <button class="tab-btn" onclick="switchTab('recipe')">🍲 המתכון המוכן</button>
    <button class="tab-btn" onclick="switchTab('shopping')">🛒 מצרכים וקניות</button>
    <button class="tab-btn" onclick="switchTab('library')">📚 המתכונים שלי (<span id="saved-count">0</span>)</button>
  </nav>

  <main>
    <!-- TAB 1: EXTRACT -->
    <div id="panel-extract" class="panel active">
      <div class="card">
        <h2 class="title">חילוץ מתכון מכל קישור</h2>
        <p class="subtitle">הדביקי קישור מאינסטגרם, טיקטוק, גוגל, או בלוג מתכונים — וה-AI יחלץ עבורך מתכון מסודר עם מצרכים, כמויות ושלבי הכנה.</p>

        <div class="input-row">
          <input type="text" id="url-input" placeholder="הדביקי כאן קישור (https://share.google/... או אינסטגרם)"/>
          <button class="btn-primary" id="extract-btn" onclick="triggerExtract()">✨ חלץ מתכון</button>
        </div>

        <div id="progress-box" class="progress-box">
          <div class="progress-title" id="progress-title">⏳ שלב 1/3: קורא את תוכן הקישור...</div>
          <div id="progress-detail" style="font-size:0.85rem; color: var(--text-muted);">מחלץ נתוני מתכון וטקסט מהאתר</div>
          <div class="stepper">
            <div class="step-node active" id="st-1">1</div>
            <div class="step-line" id="sl-1"></div>
            <div class="step-node" id="st-2">2</div>
            <div class="step-line" id="sl-2"></div>
            <div class="step-node" id="st-3">3</div>
          </div>
        </div>

        <!-- ERROR NOTIFICATION & DEVELOPER REPORTING -->
        <div id="error-box" style="display: none; background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 1.8rem; line-height: 1;">⚠️</span>
            <div style="flex: 1;">
              <h4 style="color: #991b1b; margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 800;">התרחשה שגיאה בעת חילוץ המתכון</h4>
              <div id="error-message-text" style="color: #b91c1c; font-size: 0.9rem; line-height: 1.5; background: rgba(254, 202, 202, 0.4); padding: 10px 14px; border-radius: 10px;"></div>
            </div>
          </div>
          <p style="color: #7f1d1d; font-size: 0.9rem; margin: 0 0 16px 0; line-height: 1.5;">
            לא הצלחנו לחלץ את המתכון מהקישור הזה. ניתן לנסות שוב או לשלוח את פרטי השגיאה ישירות למפתח (ישי) בוואטסאפ או במייל:
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="action-btn" style="background: #25d366; color: #ffffff; border: none; font-weight: 700; padding: 12px 18px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.92rem; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.25);" onclick="sendErrorWhatsApp()">
              📱 שלח דיווח ב-WhatsApp
            </button>
            <button type="button" class="action-btn" style="background: #2563eb; color: #ffffff; border: none; font-weight: 700; padding: 12px 18px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.92rem; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);" onclick="sendErrorEmail()">
              ✉️ שלח דיווח במייל
            </button>
            <button type="button" class="action-btn" style="background: transparent; color: #6b7280; border: 1.5px solid #d1d5db; padding: 12px 16px; border-radius: 12px; cursor: pointer; font-size: 0.92rem;" onclick="dismissError()">
              סגור
            </button>
          </div>
        </div>

        <div class="presets-title">קישורים מהירים לדוגמה</div>
        <div class="presets-grid">
          <div class="preset-card" onclick="loadPreset('מקלובה מושלמת | חן במטבח https://share.google/CzUNiEAsB93CyDEym')">
            <div class="preset-card-title">🍗 מקלובה מושלמת (חן במטבח)</div>
            <div class="preset-card-url">share.google/CzUNiEAsB93CyDEym</div>
          </div>
          <div class="preset-card" onclick="loadPreset('https://www.instagram.com/reel/spaghetti-carbonara-authentic')">
            <div class="preset-card-title">🍝 פסטה קרבונרה איטלקית</div>
            <div class="preset-card-url">אינסטגרם רילס</div>
          </div>
          <div class="preset-card" onclick="loadPreset('https://www.tiktok.com/@chef/video/shakshuka-breakfast')">
            <div class="preset-card-title">🍳 שקשוקה ביתית עשירה</div>
            <div class="preset-card-url">טיקטוק</div>
          </div>
          <div class="preset-card" onclick="loadPreset('https://youtube.com/shorts/homemade-pancakes-recipe')">
            <div class="preset-card-title">🥞 פנקייקים אווריריים</div>
            <div class="preset-card-url">יוטיוב שורטס</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: RECIPE CARD -->
    <div id="panel-recipe" class="panel">
      <div class="card" id="recipe-card-content">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3.5rem; margin-bottom: 12px;">🍲</div>
          <h3 style="color: var(--primary); margin-bottom: 8px;">עדיין לא נבחר מתכון</h3>
          <p>הדביקי קישור בלשונית "חילוץ מתכון" כדי לצפות במתכון המלא כאן.</p>
        </div>
      </div>
    </div>

    <!-- TAB 3: SHOPPING LIST -->
    <div id="panel-shopping" class="panel">
      <div class="card" id="shopping-card-content">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3.5rem; margin-bottom: 12px;">🛒</div>
          <h3 style="color: var(--primary); margin-bottom: 8px;">רשימת הקניות ריקה</h3>
          <p>רשימת המצרכים המאורגנת לפי מחלקות תופיע כאן אוטומטית בעת חילוץ מתכון.</p>
        </div>
      </div>
    </div>

    <!-- TAB 4: SAVED RECIPES -->
    <div id="panel-library" class="panel">
      <div class="card">
        <h2 class="title">ספר המתכונים השמור שלי</h2>
        <p class="subtitle">מתכונים ששמרת במכשיר — זמינים תמיד גם ללא אינטרנט.</p>
        <div id="library-list" style="margin-top: 16px;"></div>
      </div>
    </div>
  </main>

  <script>
    let currentRecipe = null;
    let servingMultiplier = 1;
    let savedRecipes = [];

    // LocalStorage Key
    const STORAGE_KEY = 'my_recipes_app_library';

    function init() {
      loadSavedRecipesFromStorage();
      renderShopping();
      if (window.navigator.standalone) {
        const b = document.getElementById('ios-tip');
        if (b) b.style.display = 'none';
      }
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
      if (activeBtn) activeBtn.classList.add('active');
      const panel = document.getElementById('panel-' + tabId);
      if (panel) panel.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function loadPreset(url) {
      document.getElementById('url-input').value = url;
      triggerExtract();
    }

    let lastExtractError = null;

    function showError(errMessage, targetUrl) {
      lastExtractError = {
        message: errMessage || 'שגיאה לא ידועה בחילוץ המתכון',
        url: targetUrl || document.getElementById('url-input').value.trim(),
        timestamp: new Date().toLocaleString('he-IL')
      };
      const errorBox = document.getElementById('error-box');
      const errorText = document.getElementById('error-message-text');
      if (errorBox && errorText) {
        errorText.textContent = lastExtractError.message;
        errorBox.style.display = 'block';
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function dismissError() {
      const errorBox = document.getElementById('error-box');
      if (errorBox) errorBox.style.display = 'none';
      lastExtractError = null;
    }

    function sendErrorWhatsApp() {
      if (!lastExtractError) return;
      const phone = '972528613494';
      const lines = [
        '📋 דיווח על תקלה בחילוץ מתכון באפליקציה:',
        '────────────────────',
        '⏰ זמן: ' + lastExtractError.timestamp,
        '🔗 קישור: ' + lastExtractError.url,
        '❌ שגיאה: ' + lastExtractError.message,
        '🌐 דפדפן ומכשיר: ' + navigator.userAgent,
        '────────────────────'
      ];
      const text = lines.join(String.fromCharCode(10));
      window.open('https://api.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(text), '_blank');
    }

    function sendErrorEmail() {
      if (!lastExtractError) return;
      const recipient = 'familymyrecipes@gmail.com';
      const subject = 'דיווח על תקלה בחילוץ מתכון - ספר המתכונים';
      const lines = [
        'שלום ישי,',
        '',
        'נתקלתי בתקלה בעת חילוץ מתכון באפליקציה:',
        '',
        '⏰ זמן: ' + lastExtractError.timestamp,
        '🔗 קישור למתכון: ' + lastExtractError.url,
        '❌ פירוט השגיאה: ' + lastExtractError.message,
        '🌐 דפדפן ומכשיר: ' + navigator.userAgent,
        '',
        'תודה!'
      ];
      const body = lines.join(String.fromCharCode(10));
      window.location.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }

    async function triggerExtract() {
      const url = document.getElementById('url-input').value.trim();
      if (!url) return;

      dismissError();

      const btn = document.getElementById('extract-btn');
      const progressBox = document.getElementById('progress-box');
      const pTitle = document.getElementById('progress-title');
      const pDetail = document.getElementById('progress-detail');

      btn.disabled = true;
      progressBox.style.display = 'block';
      pTitle.textContent = '⏳ שלב 1/3: מוריד את תוכן המתכון...';
      pDetail.textContent = 'מחלץ את הקישור ומזהה את מקור המתכון';
      document.getElementById('st-1').classList.add('active');
      document.getElementById('st-2').classList.remove('active');
      document.getElementById('st-3').classList.remove('active');
      document.getElementById('sl-1').classList.remove('active');
      document.getElementById('sl-2').classList.remove('active');

      try {
        const res = await fetch('/api/v1/recipes/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceUrl: url })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || ('שגיאת שרת (' + res.status + ') בחילוץ המתכון'));
        }

        document.getElementById('sl-1').classList.add('active');
        document.getElementById('st-2').classList.add('active');
        pTitle.textContent = '🧠 שלב 2/3: מעבד מצרכים ושלבי הכנה עם AI...';
        pDetail.textContent = 'ממיר כמויות, מודד מנות ומסדר הוראות';

        let data = await res.json();
        let recipe = (data && data.recipe) ? data.recipe : (data && data.title ? data : null);

        // If job is asynchronous and still processing, poll for completion
        if (!recipe && data && data.jobId) {
          let attempts = 0;
          let jobFailedError = null;
          while (!recipe && attempts < 40) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
            try {
              const jobRes = await fetch('/api/v1/recipes/jobs/' + data.jobId);
              if (jobRes.ok) {
                const job = await jobRes.json();
                if (job.status === 'completed' && job.recipe) {
                  recipe = job.recipe;
                  break;
                }
                if (job.status === 'failed') {
                  jobFailedError = job.error || 'נכשלה פעולת חילוץ המתכון מהסרטון';
                  break;
                }
                if (job.message) {
                  pDetail.textContent = job.message;
                }
              }
            } catch (pollErr) {
              if (attempts >= 40) throw pollErr;
            }
          }
          if (jobFailedError) {
            throw new Error(jobFailedError);
          }
        }

        if (!recipe || !recipe.title || recipe.title === 'undefined') {
          throw new Error('לא התקבלו נתוני מתכון תקינים מהשרת');
        }

        document.getElementById('sl-2').classList.add('active');
        document.getElementById('st-3').classList.add('active');
        pTitle.textContent = '✨ שלב 3/3: מכין את ספר המתכונים...';

        await new Promise(r => setTimeout(r, 300));

        currentRecipe = recipe;
        servingMultiplier = 1;
        renderRecipe();
        saveRecipeToStorage(recipe);

        btn.disabled = false;
        progressBox.style.display = 'none';
        switchTab('recipe');
      } catch (err) {
        btn.disabled = false;
        progressBox.style.display = 'none';
        showError(err.message || String(err), url);
      }
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function onImgError(img) {
      img.onerror = null;
      img.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop';
    }

    function getPlatformBadgeText(platform) {
      var p = String(platform || '').toLowerCase();
      if (p.indexOf('instagram') >= 0) return '📸 אינסטגרם';
      if (p.indexOf('tiktok') >= 0) return '🎵 טיקטוק';
      if (p.indexOf('youtube') >= 0) return '▶️ יוטיוב';
      if (p.indexOf('facebook') >= 0) return '👥 פייסבוק';
      return '🍳 מתכון';
    }

    function getRecipeImageHtml(recipe) {
      if (!recipe) return '';
      var fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop';
      var u = (recipe.imageUrl && (recipe.imageUrl.indexOf('http://') === 0 || recipe.imageUrl.indexOf('https://') === 0))
        ? encodeURI(String(recipe.imageUrl).trim())
        : fallback;
      var platformBadge = getPlatformBadgeText(recipe.platform);
      var categoryBadge = recipe.category || (recipe.tags && recipe.tags[0]) || 'כללי';

      return '<div class="recipe-hero-container">' +
        '<img src="' + u + '" referrerpolicy="no-referrer" alt="' + escapeHtml(recipe.title || '') + '" class="recipe-hero-image" onerror="onImgError(this)">' +
        '<div class="recipe-hero-overlay">' +
          '<span class="recipe-hero-badge">' + platformBadge + '</span>' +
          '<span class="recipe-hero-badge" style="background: rgba(16, 185, 129, 0.9);">' + escapeHtml(categoryBadge) + '</span>' +
        '</div>' +
      '</div>';
    }

    function renderRecipe() {
      if (!currentRecipe) return;
      const baseServings = currentRecipe.servings || 4;
      const servings = Math.round(baseServings * servingMultiplier);

      let html = \`
        \${getRecipeImageHtml(currentRecipe)}

        <div class="recipe-header" style="margin-top: 14px;">
          <h1 class="title" style="margin-top: 0; font-size: 1.65rem;">\${escapeHtml(currentRecipe.title)}</h1>
          <p class="subtitle" style="margin-bottom: 12px; font-size: 0.95rem; line-height: 1.5;">\${escapeHtml(currentRecipe.description || '')}</p>
        </div>

        <div class="meta-pills">
          <div class="meta-pill-item">
            <div class="meta-pill-label">זמן הכנה</div>
            <div class="meta-pill-val">\${currentRecipe.prepTimeMinutes ? currentRecipe.prepTimeMinutes + " דק'" : '--'}</div>
          </div>
          <div class="meta-pill-item">
            <div class="meta-pill-label">זמן בישול</div>
            <div class="meta-pill-val">\${currentRecipe.cookTimeMinutes ? currentRecipe.cookTimeMinutes + " דק'" : '--'}</div>
          </div>
          <div class="meta-pill-item">
            <div class="meta-pill-label">זמן כולל</div>
            <div class="meta-pill-val">\${currentRecipe.totalTimeMinutes ? currentRecipe.totalTimeMinutes + " דק'" : '--'}</div>
          </div>
        </div>

        <div class="scaler-card">
          <span style="font-weight: 700; font-size: 1rem;">כמות מנות: <strong style="color: var(--primary);">\${servings}</strong> (\${servingMultiplier}x)</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="scaler-btn" onclick="scaleServings(-0.5)">-</button>
            <button class="scaler-btn" onclick="scaleServings(0.5)">+</button>
          </div>
        </div>

        <h3 style="margin-bottom: 12px; font-weight: 800; color: var(--primary);">מצרכים (\${currentRecipe.ingredients ? currentRecipe.ingredients.length : 0})</h3>
        <div id="ingredients-list">
          \${(currentRecipe.ingredients || []).map(ing => {
            const rawAmount = ing.amount !== null && ing.amount !== undefined ? (ing.amount * servingMultiplier) : null;
            const scaled = rawAmount !== null ? (rawAmount % 1 === 0 ? rawAmount : rawAmount.toFixed(1)) : null;
            const amountText = scaled ? (scaled + ' ' + (ing.unit || '')) : '';
            return \`
              <div class="item-row" onclick="this.classList.toggle('checked')">
                <div class="checkbox">✓</div>
                <div style="flex: 1;">
                  <strong>\${amountText}</strong> \${ing.name}
                  \${ing.notes ? \`<span style="color: var(--text-muted); font-size: 0.8rem;">(\${ing.notes})</span>\` : ''}
                </div>
              </div>
            \`;
          }).join('')}
        </div>

        <h3 style="margin: 24px 0 12px; font-weight: 800; color: var(--primary);">הוראות הכנה</h3>
        <div>
          \${(currentRecipe.instructions || []).map(step => \`
            <div class="step-card">
              <div class="step-header">
                <div class="step-badge">\${step.stepNumber}</div>
                \${step.durationMinutes ? \`<button class="timer-btn" onclick="toggleTimer(this, \${step.durationMinutes})">⏱ \${step.durationMinutes} דק'</button>\` : ''}
              </div>
              <p style="font-size: 0.95rem; line-height: 1.6;">\${step.instruction}</p>
              \${step.tip ? \`<div style="margin-top: 8px; font-size: 0.85rem; color: #b45309; background: #fef3c7; padding: 6px 10px; border-radius: 8px;">💡 טיפ: \${step.tip}</div>\` : ''}
            </div>
          \`).join('')}
        </div>

        <div class="action-row">
          <button class="action-btn" onclick="shareWhatsApp()">📤 שתף ב-WhatsApp</button>
          <button class="action-btn" onclick="copyIngredients()">📋 העתק מצרכים</button>
          <button class="action-btn" style="background: rgba(16, 185, 129, 0.15); color: #047857; border-color: #059669;" onclick="addCurrentRecipeToShopping()">🛒 הוסף לרשימת קניות</button>
          <button class="action-btn" style="background: rgba(5, 150, 105, 0.15); color: var(--accent); border-color: var(--accent);" onclick="saveCurrentRecipe()">💾 שמור בספר שלי</button>
        </div>
      \`;

      document.getElementById('recipe-card-content').innerHTML = html;
    }

    function scaleServings(delta) {
      servingMultiplier = Math.max(0.5, servingMultiplier + delta);
      renderRecipe();
    }

    function toggleTimer(btn, minutes) {
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        btn.textContent = '⏱ ' + minutes + " דק'";
        if (btn._timer) clearInterval(btn._timer);
      } else {
        btn.classList.add('active');
        let seconds = minutes * 60;
        btn._timer = setInterval(() => {
          seconds--;
          if (seconds <= 0) {
            clearInterval(btn._timer);
            btn.classList.remove('active');
            btn.textContent = '🔔 הזמן הסתיים!';
            alert('🔔 הזמן הסתיים עבור שלב זה!');
          } else {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            btn.textContent = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s;
          }
        }, 1000);
      }
    }

    function renderShopping() {
      const shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      const container = document.getElementById('shopping-card-content');
      
      if (shopping.length === 0) {
        container.innerHTML = \`
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="font-size: 3.5rem; margin-bottom: 12px;">🛒</div>
            <h3 style="color: var(--primary); margin-bottom: 8px;">רשימת הקניות ריקה</h3>
            <p>מצרכים אינם מתווספים באופן אוטומטי.</p>
            <p style="font-size: 0.85rem; margin-top: 6px;">כדי להוסיף מצרכים ממתכון כלשהו, לחצי על <strong>"🛒 הוסף לרשימת קניות"</strong> בעמוד המתכון.</p>
          </div>
        \`;
        return;
      }

      let html = \`
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 class="title" style="margin-bottom: 4px;">רשימת קניות (\${shopping.length} פריטים)</h2>
            <div style="color: var(--text-muted); font-size: 0.85rem;">סמני פריטים שנקנו</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="action-btn" onclick="clearCheckedShopping()">נקה שנקנו</button>
            <button class="action-btn" style="color: var(--danger);" onclick="clearAllShopping()">מחק הכל</button>
          </div>
        </div>
      \`;

      html += shopping.map((item, idx) => \`
        <div class="item-row \${item.checked ? 'checked' : ''}" onclick="toggleShoppingItem(\${idx})">
          <div class="checkbox">\${item.checked ? '✓' : ''}</div>
          <div style="flex: 1;">
            <span><strong>\${item.text}</strong></span>
            \${item.source ? \`<span style="color: var(--text-muted); font-size: 0.75rem; margin-right: 6px;">(\${item.source})</span>\` : ''}
          </div>
          <button class="action-btn" style="color: var(--danger); padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); removeShoppingItem(\${idx})">✕</button>
        </div>
      \`).join('');

      container.innerHTML = html;
    }

    function addCurrentRecipeToShopping() {
      if (!currentRecipe || !currentRecipe.ingredients) return;
      const shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      const newItems = currentRecipe.ingredients.map(ing => {
        const rawAmount = ing.amount !== null && ing.amount !== undefined ? (ing.amount * servingMultiplier) : null;
        const scaled = rawAmount !== null ? (rawAmount % 1 === 0 ? rawAmount : rawAmount.toFixed(1)) : null;
        const amountText = scaled ? (scaled + ' ' + (ing.unit || '')) : '';
        return {
          id: 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          text: (amountText + ' ' + ing.name).trim(),
          source: currentRecipe.title,
          checked: false
        };
      });
      shopping.push(...newItems);
      localStorage.setItem('my_recipes_app_shopping', JSON.stringify(shopping));
      renderShopping();
      alert('המצרכים מתוך "' + currentRecipe.title + '" נוספו בהצלחה לרשימת הקניות!');
    }

    function toggleShoppingItem(idx) {
      const shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      if (shopping[idx]) {
        shopping[idx].checked = !shopping[idx].checked;
        localStorage.setItem('my_recipes_app_shopping', JSON.stringify(shopping));
        renderShopping();
      }
    }

    function removeShoppingItem(idx) {
      const shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      shopping.splice(idx, 1);
      localStorage.setItem('my_recipes_app_shopping', JSON.stringify(shopping));
      renderShopping();
    }

    function clearCheckedShopping() {
      let shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      shopping = shopping.filter(item => !item.checked);
      localStorage.setItem('my_recipes_app_shopping', JSON.stringify(shopping));
      renderShopping();
    }

    function clearAllShopping() {
      if (confirm('האם למחוק את כל המוצרים מרשימת הקניות?')) {
        localStorage.removeItem('my_recipes_app_shopping');
        renderShopping();
      }
    }

    function shareWhatsApp() {
      if (!currentRecipe) return;
      const text = 'מתכון: ' + currentRecipe.title + '\\n' + window.location.href;
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
    }

    function copyIngredients() {
      if (!currentRecipe || !currentRecipe.ingredients) return;
      const text = currentRecipe.title + '\\nמצרכים:\\n' + currentRecipe.ingredients.map(i => '- ' + (i.amount ? i.amount + ' ' : '') + (i.unit ? i.unit + ' ' : '') + i.name).join('\\n');
      navigator.clipboard.writeText(text).then(() => {
        alert('המצרכים הועתקו ללוח!');
      });
    }

    function saveCurrentRecipe() {
      if (!currentRecipe) return;
      saveRecipeToStorage(currentRecipe);
      alert('המתכון נשמר בהצלחה בספר המתכונים שלך!');
    }

    function saveRecipeToStorage(recipe) {
      if (!recipe) return;
      const cleanRecipe = (recipe.recipe && recipe.recipe.title) ? recipe.recipe : recipe;
      if (!cleanRecipe.title || cleanRecipe.title === 'undefined') return;

      let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const existing = list.findIndex(r => r.title === cleanRecipe.title || (r.id && r.id === cleanRecipe.id));
      if (existing >= 0) {
        list[existing] = cleanRecipe;
      } else {
        list.unshift(cleanRecipe);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      savedRecipes = list;
      updateLibraryUI();
    }

    function loadSavedRecipesFromStorage() {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      // Sanitize: unpack any previously wrapped { recipe: { ... } } or corrupted undefined entries
      savedRecipes = raw.map(item => {
        if (item && item.recipe && item.recipe.title) {
          return item.recipe;
        }
        return item;
      }).filter(item => item && item.title && item.title !== 'undefined');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
      updateLibraryUI();

      // If currentRecipe is null or undefined, and we have saved recipes, automatically display the latest saved recipe
      if ((!currentRecipe || !currentRecipe.title || currentRecipe.title === 'undefined') && savedRecipes.length > 0) {
        currentRecipe = savedRecipes[0];
        renderRecipe();
      }
    }

    function updateLibraryUI() {
      document.getElementById('saved-count').textContent = savedRecipes.length;
      const container = document.getElementById('library-list');
      if (savedRecipes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">עדיין אין מתכונים שמורים. חלצי מתכון חדש כדי להתחיל את האוסף שלך!</p>';
        return;
      }

      container.innerHTML = savedRecipes.map((r, idx) => {
        const fallback = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&auto=format&fit=crop';
        const imgUrl = (r.imageUrl && (r.imageUrl.indexOf('http://') === 0 || r.imageUrl.indexOf('https://') === 0))
          ? encodeURI(String(r.imageUrl).trim())
          : fallback;
        const platformBadge = getPlatformBadgeText(r.platform);
        const timeText = r.totalTimeMinutes ? (r.totalTimeMinutes + ' דק׳') : (r.prepTimeMinutes || r.cookTimeMinutes ? ((r.prepTimeMinutes || 0) + (r.cookTimeMinutes || 0) + ' דק׳') : '25 דק׳');
        const ingCount = (r.ingredients || []).length;

        return \`
          <div class="recipe-card-item" role="button" tabindex="0" onclick="openSavedRecipe(\${idx})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSavedRecipe(\${idx});}" title="לחצי לצפייה במתכון המלא">
            <div class="recipe-card-thumb-wrap">
              <img src="\${imgUrl}" referrerpolicy="no-referrer" alt="\${escapeHtml(r.title)}" class="recipe-card-thumb" onerror="onImgError(this)">
              <div class="recipe-card-platform-badge">\${platformBadge}</div>
            </div>
            <div class="recipe-card-info">
              <span class="badge-category" style="font-size: 0.72rem; padding: 2px 8px;">\${escapeHtml(r.category || 'כללי')}</span>
              <strong class="recipe-card-title">\${escapeHtml(r.title)}</strong>
              <div class="recipe-card-meta">
                <span>⏱️ \${timeText}</span>
                <span>•</span>
                <span>🥗 \${ingCount} מצרכים</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button type="button" class="recipe-card-delete" title="מחק מתכון" aria-label="מחק מתכון" onclick="event.stopPropagation(); deleteSavedRecipe(\${idx})">✕</button>
              <span class="recipe-card-arrow" aria-hidden="true">‹</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    function openSavedRecipe(idx) {
      const r = savedRecipes[idx];
      if (r) {
        currentRecipe = (r.recipe && r.recipe.title) ? r.recipe : r;
        servingMultiplier = 1;
        renderRecipe();
        switchTab('recipe');
      }
    }

    function deleteSavedRecipe(idx) {
      if (confirm('האם למחוק מתכון זה מהספר?')) {
        savedRecipes.splice(idx, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
        updateLibraryUI();
      }
    }

    window.onload = init;
  </script>
</body>
</html>`;
}
