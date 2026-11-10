// Secret Admin Dashboard for MyRecipesApp
export function getAdminDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>לוח בקרה וניהול | ספר המתכונים שלי</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --surface: #111827;
      --surface-card: #1f2937;
      --border: #374151;
      --primary: #10b981;
      --primary-hover: #059669;
      --accent: #6366f1;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --warning: #f59e0b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Heebo', -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      direction: rtl;
      display: flex;
      flex-direction: column;
    }

    /* Top Navbar */
    .admin-nav {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .admin-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .admin-badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid var(--primary);
      color: var(--primary);
      font-size: 0.75rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 999px;
    }

    .admin-btn-logout {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: all 0.2s ease;
    }
    .admin-btn-logout:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: var(--danger);
      color: var(--danger);
    }

    /* Main Container */
    .admin-container {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 24px 16px 60px;
      flex: 1;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }

    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kpi-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .kpi-value {
      font-size: 1.8rem;
      font-weight: 900;
      color: var(--primary);
      letter-spacing: -0.02em;
    }

    /* Tabs */
    .tabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      overflow-x: auto;
    }

    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.95rem;
      padding: 12px 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    /* Content Cards */
    .admin-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px;
      margin-bottom: 24px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 800;
    }

    /* Forms */
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) auto;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .form-input, .form-select {
      background: var(--surface-card);
      border: 1px solid var(--border);
      color: var(--text);
      font-family: inherit;
      font-size: 0.9rem;
      padding: 10px 14px;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--primary);
    }

    .btn-submit {
      background: var(--primary);
      color: #04241a;
      border: none;
      font-family: inherit;
      font-weight: 800;
      font-size: 0.92rem;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
      height: 42px;
    }
    .btn-submit:hover {
      background: var(--primary-hover);
    }

    /* Tables */
    .admin-table-wrapper {
      overflow-x: auto;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      text-align: right;
      font-size: 0.9rem;
    }

    .admin-table th {
      background: rgba(31, 41, 55, 0.5);
      padding: 12px 14px;
      color: var(--text-muted);
      font-weight: 700;
      border-bottom: 1px solid var(--border);
    }

    .admin-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(55, 65, 81, 0.4);
    }

    .badge-code {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid var(--accent);
      color: #a5b4fc;
      font-weight: 800;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }

    .badge-status {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
    }
    .badge-status.active {
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary);
      border: 1px solid var(--primary);
    }
    .badge-status.inactive {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border: 1px solid var(--danger);
    }

    .btn-icon-action {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1rem;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .btn-icon-action:hover {
      background: rgba(239, 68, 68, 0.2);
      color: var(--danger);
    }

    /* Login Modal Screen */
    #login-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 13, 22, 0.96);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .login-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }

    .login-icon {
      font-size: 3rem;
      margin-bottom: 12px;
    }

    .login-title {
      font-size: 1.4rem;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .login-subtitle {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-bottom: 24px;
    }

    /* Toast */
    #admin-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: #fff;
      border: 1px solid var(--primary);
      padding: 10px 22px;
      border-radius: 30px;
      font-weight: 700;
      font-size: 0.9rem;
      display: none;
      z-index: 2000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>

  <!-- Login Overlay -->
  <div id="login-overlay">
    <div class="login-box">
      <div class="login-icon">🔐</div>
      <h2 class="login-title">מערכת ניהול סודית</h2>
      <p class="login-subtitle">הגישה מותרת למנהלי המערכת בלבד</p>
      <form onsubmit="handleAdminLogin(event)">
        <div class="form-group" style="text-align: right; margin-bottom: 16px;">
          <label class="form-label">סיסמת ניהול ראשית</label>
          <input type="password" id="admin-password-input" class="form-input" placeholder="הזן סיסמת Master..." required autofocus />
        </div>
        <button type="submit" id="login-btn" class="btn-submit" style="width: 100%;">כניסה ללוח הניהול ⚡</button>
      </form>
    </div>
  </div>

  <!-- Admin Nav -->
  <header class="admin-nav">
    <div class="admin-brand">
      <span style="font-size: 1.3rem;">🍳</span>
      <h1 style="font-size: 1.15rem; font-weight: 900;">ניהול קופונים ומנויים | MyRecipes</h1>
      <span class="admin-badge">Admin Pro</span>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span id="admin-db-status" style="font-size: 0.8rem; color: var(--primary);">🟢 Neon DB מחובר</span>
      <button class="admin-btn-logout" onclick="adminLogout()">יציאה 🚪</button>
    </div>
  </header>

  <!-- Admin Container -->
  <main class="admin-container">

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-title">סה״כ משתמשים</span>
        <span class="kpi-value" id="kpi-users">-</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">מנויי VIP / Pro</span>
        <span class="kpi-value" id="kpi-pro">-</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">מתכונים בענן</span>
        <span class="kpi-value" id="kpi-recipes">-</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">קודי הטבה פעילים</span>
        <span class="kpi-value" id="kpi-promos">-</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-title">מיילים ברשימת VIP</span>
        <span class="kpi-value" id="kpi-vips">-</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button class="tab-btn active" onclick="switchAdminTab('promos', this)">🎁 קודי הטבה וקופונים</button>
      <button class="tab-btn" onclick="switchAdminTab('vips', this)">👑 רשימת מיילים חינמיים (VIP Whitelist)</button>
      <button class="tab-btn" onclick="switchAdminTab('trends', this)">🔥 הוספת מתכון ויראלי לגילוי</button>
      <button class="tab-btn" onclick="switchAdminTab('users', this)">👥 משתמשים רשומים</button>
    </div>

    <!-- Tab 1: Promo Codes -->
    <div id="tab-promos">
      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">יצירת קוד הטבה חדש</h2>
        </div>
        <form onsubmit="handleCreatePromo(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">קוד ההטבה (אותיות ומספרים)</label>
              <input type="text" id="promo-code" class="form-input" placeholder="למשל: FAMILY2026, SUMMER50" required />
            </div>
            <div class="form-group">
              <label class="form-label">סוג הטבה</label>
              <select id="promo-type" class="form-select">
                <option value="lifetime_pro">Chef Pro לכל החיים (משפחה/חברים)</option>
                <option value="annual_pro">Chef Pro שנתי (12 חודשים)</option>
                <option value="monthly_pro">Chef Pro חודשי</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">מגבלת שימושים (ריק = ללא הגבלה)</label>
              <input type="number" id="promo-max" class="form-input" placeholder="ללא הגבלה" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label">הערות / ייעוד</label>
              <input type="text" id="promo-notes" class="form-input" placeholder="למשל: עבור קבוצת בישול בפייסבוק" />
            </div>
            <button type="submit" class="btn-submit">צור קוד ✨</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">קודי הטבה קיימים</h2>
          <button class="form-input" style="cursor: pointer; padding: 6px 12px;" onclick="loadPromoCodes()">רענן רשימה 🔄</button>
        </div>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>קוד הטבה</th>
                <th>סוג הטבה</th>
                <th>שימושים / מגבלה</th>
                <th>סטטוס</th>
                <th>הערות</th>
                <th>נוצר בתאריך</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody id="promo-table-body">
              <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">טוען קודי הטבה...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 2: VIP Emails -->
    <div id="tab-vips" style="display: none;">
      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">הוספת כתובת מייל ל-VIP Whitelist (חינם ללא תשלום)</h2>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 16px;">
          משתמש שכתובת המייל שלו מופיעה כאן יקבל באופן מיידי מעמד <strong>Chef Pro לכל החיים</strong> ללא הגבלת חילוצים, ללא צורך בהזנת קוד הטבה.
        </p>
        <form onsubmit="handleAddVipEmail(event)">
          <div class="form-row">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">כתובת אימייל (Google / משתמש)</label>
              <input type="email" id="vip-email" class="form-input" placeholder="name@example.com" required />
            </div>
            <div class="form-group">
              <label class="form-label">הערה / שיוך</label>
              <input type="text" id="vip-notes" class="form-input" placeholder="למשל: אמא, שף אורח, שותף" />
            </div>
            <button type="submit" class="btn-submit">הוסף לרשימת VIP 👑</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">מיילים מאושרים ברשימת ה-VIP</h2>
          <button class="form-input" style="cursor: pointer; padding: 6px 12px;" onclick="loadVipEmails()">רענן רשימה 🔄</button>
        </div>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>כתובת אימייל</th>
                <th>דרגת מנוי</th>
                <th>הערות</th>
                <th>תאריך הוספה</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody id="vip-table-body">
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">טוען רשימת VIP...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 4: Viral Trends -->
    <div id="tab-trends" style="display: none;">
      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">פרסום מתכון ויראלי חדש לטאב "גילוי" (Discover)</h2>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 16px;">
          ראית סרטון בישול מעולה ברשת? הדבק כאן את הקישור מ-TikTok, Instagram או YouTube. המערכת תחלץ את המתכון המלא באמצעות ה-AI ותפרסם אותו בראש טאב הגילוי עבור כל משתמשי האפליקציה!
        </p>
        <form onsubmit="handlePublishTrend(event)">
          <div class="form-row">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">קישור לסרטון (TikTok, Instagram Reel, YouTube Shorts)</label>
              <input type="url" id="trend-url" class="form-input" placeholder="https://www.tiktok.com/@... או https://www.instagram.com/reel/..." required />
            </div>
            <button type="submit" id="btn-publish-trend" class="btn-submit">חלץ ופרסם לגילוי ✨</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Tab 3: Users -->
    <div id="tab-users" style="display: none;">
      <div class="admin-card">
        <div class="card-header">
          <h2 class="card-title">משתמשי המערכת הרשומים ב-Neon Postgres</h2>
          <button class="form-input" style="cursor: pointer; padding: 6px 12px;" onclick="loadUsers()">רענן 🔄</button>
        </div>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>שם / מזהה</th>
                <th>אימייל</th>
                <th>סטטוס Pro</th>
                <th>סוג מנוי</th>
                <th>תאריך הצטרפות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">טוען משתמשים...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </main>

  <div id="admin-toast"></div>

  <script>
    let adminToken = localStorage.getItem('myrecipes_admin_token') || '';

    async function init() {
      if (adminToken) {
        document.getElementById('login-overlay').style.display = 'none';
        await refreshAllData();
      }
    }

    async function handleAdminLogin(e) {
      e.preventDefault();
      const pass = document.getElementById('admin-password-input').value;
      const btn = document.getElementById('login-btn');
      btn.textContent = 'מאמת סיסמה...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/v1/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'סיסמת ניהול שגויה');
          return;
        }

        const data = await res.json();
        adminToken = data.token;
        localStorage.setItem('myrecipes_admin_token', adminToken);
        document.getElementById('login-overlay').style.display = 'none';
        showToast('התחברת בהצלחה ללוח הניהול 🚀');
        await refreshAllData();
      } catch (err) {
        alert('שגיאת תקשורת עם השרת');
      } finally {
        btn.textContent = 'כניסה ללוח הניהול ⚡';
        btn.disabled = false;
      }
    }

    function adminLogout() {
      adminToken = '';
      localStorage.removeItem('myrecipes_admin_token');
      document.getElementById('login-overlay').style.display = 'flex';
      document.getElementById('admin-password-input').value = '';
    }

    async function refreshAllData() {
      await Promise.all([
        loadStats(),
        loadPromoCodes(),
        loadVipEmails()
      ]);
    }

    async function adminFetch(url, options = {}) {
      options.headers = options.headers || {};
      options.headers['Authorization'] = 'Bearer ' + adminToken;
      options.headers['x-admin-token'] = adminToken;
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        adminLogout();
        throw new Error('פג תוקף חיבור הניהול');
      }
      return res;
    }

    async function loadStats() {
      try {
        const res = await adminFetch('/api/v1/admin/stats');
        if (res.ok) {
          const stats = await res.json();
          document.getElementById('kpi-users').textContent = stats.totalUsers || '0';
          document.getElementById('kpi-pro').textContent = stats.proUsers || '0';
          document.getElementById('kpi-recipes').textContent = stats.totalRecipes || '0';
          document.getElementById('kpi-promos').textContent = stats.activePromoCodes || '0';
          document.getElementById('kpi-vips').textContent = stats.vipEmailsCount || '0';
        }
      } catch (e) {}
    }

    async function loadPromoCodes() {
      const tbody = document.getElementById('promo-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/promo-codes');
        if (res.ok) {
          const data = await res.json();
          const codes = data.codes || [];
          if (codes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">אין עדיין קודי הטבה</td></tr>';
            return;
          }
          tbody.innerHTML = codes.map(c => \`
            <tr>
              <td><span class="badge-code">\${c.code}</span></td>
              <td>\${c.discountType === 'lifetime_pro' ? 'Chef Pro לכל החיים 🌟' : c.discountType}</td>
              <td><strong>\${c.usedCount}</strong> / \${c.maxUses === null ? 'ללא הגבלה' : c.maxUses}</td>
              <td><span class="badge-status \${c.isActive ? 'active' : 'inactive'}">\${c.isActive ? 'פעיל' : 'מושבת'}</span></td>
              <td style="color: var(--text-muted);">\${c.notes || '-'}</td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">\${new Date(c.createdAt).toLocaleDateString('he-IL')}</td>
              <td>
                <button class="btn-icon-action" title="\${c.isActive ? 'השבת קוד' : 'הפעל קוד'}" onclick="togglePromo('\${c.code}', \${!c.isActive})">\${c.isActive ? '⏸️' : '▶️'}</button>
                <button class="btn-icon-action" title="מחק קוד" onclick="deletePromo('\${c.code}')">🗑️</button>
              </td>
            </tr>
          \`).join('');
        }
      } catch (e) {}
    }

    async function handleCreatePromo(e) {
      e.preventDefault();
      const code = document.getElementById('promo-code').value.trim();
      const discountType = document.getElementById('promo-type').value;
      const maxUsesVal = document.getElementById('promo-max').value;
      const maxUses = maxUsesVal ? parseInt(maxUsesVal, 10) : undefined;
      const notes = document.getElementById('promo-notes').value.trim();

      try {
        const res = await adminFetch('/api/v1/admin/promo-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, discountType, maxUses, notes })
        });
        if (res.ok) {
          showToast('קוד ההטבה נוצר בהצלחה! 🎉');
          document.getElementById('promo-code').value = '';
          document.getElementById('promo-notes').value = '';
          document.getElementById('promo-max').value = '';
          await loadPromoCodes();
          await loadStats();
        } else {
          const err = await res.json();
          alert(err.error || 'שגיאה ביצירת קוד');
        }
      } catch (e) {}
    }

    async function togglePromo(code, isActive) {
      try {
        await adminFetch('/api/v1/admin/promo-codes/' + encodeURIComponent(code), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive })
        });
        showToast('סטטוס הקוד עודכן');
        await loadPromoCodes();
        await loadStats();
      } catch (e) {}
    }

    async function deletePromo(code) {
      if (!confirm('האם למחוק לצמיתות את קוד ההטבה ' + code + '?')) return;
      try {
        await adminFetch('/api/v1/admin/promo-codes/' + encodeURIComponent(code), {
          method: 'DELETE'
        });
        showToast('קוד ההטבה נמחק');
        await loadPromoCodes();
        await loadStats();
      } catch (e) {}
    }

    async function loadVipEmails() {
      const tbody = document.getElementById('vip-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/vip-emails');
        if (res.ok) {
          const data = await res.json();
          const emails = data.emails || [];
          if (emails.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">אין עדיין מיילים ברשימת ה-VIP</td></tr>';
            return;
          }
          tbody.innerHTML = emails.map(v => \`
            <tr>
              <td><strong>\${v.email}</strong></td>
              <td><span class="badge-code" style="border-color: #f59e0b; color: #fbbf24;">\${v.tier}</span></td>
              <td style="color: var(--text-muted);">\${v.notes || '-'}</td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">\${new Date(v.createdAt).toLocaleDateString('he-IL')}</td>
              <td>
                <button class="btn-icon-action" title="הסר מרשימת VIP" onclick="deleteVipEmail('\${v.email}')">🗑️</button>
              </td>
            </tr>
          \`).join('');
        }
      } catch (e) {}
    }

    async function handleAddVipEmail(e) {
      e.preventDefault();
      const email = document.getElementById('vip-email').value.trim();
      const notes = document.getElementById('vip-notes').value.trim();

      try {
        const res = await adminFetch('/api/v1/admin/vip-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tier: 'family_vip', notes })
        });
        if (res.ok) {
          showToast('המייל נוסף בהצלחה לרשימת ה-VIP! 👑');
          document.getElementById('vip-email').value = '';
          document.getElementById('vip-notes').value = '';
          await loadVipEmails();
          await loadStats();
        } else {
          const err = await res.json();
          alert(err.error || 'שגיאה בהוספת מייל');
        }
      } catch (e) {}
    }

    async function deleteVipEmail(email) {
      if (!confirm('להסיר את ' + email + ' מרשימת ה-VIP?')) return;
      try {
        await adminFetch('/api/v1/admin/vip-emails/' + encodeURIComponent(email), {
          method: 'DELETE'
        });
        showToast('המייל הוסר מרשימת ה-VIP');
        await loadVipEmails();
        await loadStats();
      } catch (e) {}
    }

    async function loadUsers() {
      const tbody = document.getElementById('users-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/users');
        if (res.ok) {
          const data = await res.json();
          const users = data.users || [];
          if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">אין עדיין משתמשים רשומים</td></tr>';
            return;
          }
          tbody.innerHTML = users.map(u => \`
            <tr>
              <td><strong>\${u.name || u.id}</strong></td>
              <td>\${u.email}</td>
              <td><span class="badge-status \${u.isPro ? 'active' : 'inactive'}">\${u.isPro ? 'Pro פעיל 👑' : 'חינם (5/חודש)'}</span></td>
              <td><span class="badge-code">\${u.proTier || 'free'}</span></td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">\${new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
              <td>
                <button class="btn-icon-action" title="\${u.isPro ? 'בטל Pro' : 'שדרג ל-Pro'}" onclick="toggleUserPro('\${u.id}', \${!u.isPro})">\${u.isPro ? 'שנמך לחינם' : 'שדרג ל-Pro 🌟'}</button>
              </td>
            </tr>
          \`).join('');
        }
      } catch (e) {}
    }

    async function toggleUserPro(userId, isPro) {
      try {
        await adminFetch('/api/v1/admin/users/' + encodeURIComponent(userId) + '/pro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPro, proTier: 'lifetime_pro' })
        });
        showToast('סטטוס המשתמש עודכן');
        await loadUsers();
        await loadStats();
      } catch (e) {}
    }

    async function handlePublishTrend(e) {
      e.preventDefault();
      const url = document.getElementById('trend-url').value.trim();
      const btn = document.getElementById('btn-publish-trend');
      btn.textContent = 'מחלץ ומפרסם מתכון... ⏳';
      btn.disabled = true;

      try {
        const res = await adminFetch('/api/v1/admin/trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (res.ok) {
          const data = await res.json();
          showToast('המתכון "' + (data.recipe?.title || 'החדש') + '" פורסם בהצלחה לטאב הגילוי! 🎉');
          document.getElementById('trend-url').value = '';
          await loadStats();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'שגיאה בחילוץ ופרסום המתכון');
        }
      } catch (err) {
        alert('שגיאת תקשורת עם השרת');
      } finally {
        btn.textContent = 'חלץ ופרסם לגילוי ✨';
        btn.disabled = false;
      }
    }

    function switchAdminTab(tab, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-promos').style.display = tab === 'promos' ? 'block' : 'none';
      document.getElementById('tab-vips').style.display = tab === 'vips' ? 'block' : 'none';
      document.getElementById('tab-trends').style.display = tab === 'trends' ? 'block' : 'none';
      document.getElementById('tab-users').style.display = tab === 'users' ? 'block' : 'none';
      if (tab === 'users') loadUsers();
    }

    function showToast(msg) {
      const el = document.getElementById('admin-toast');
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 3000);
    }

    window.onload = init;
  </script>
</body>
</html>
`;
}

