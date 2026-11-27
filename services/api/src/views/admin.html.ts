// Secret Admin Dashboard for MyRecipesApp - Modern Hebrew RTL App-Shell Overhaul
export function getAdminDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>לוח בקרה וניהול | ספר המתכונים שלי</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --bg-surface: #111827;
      --bg-card: #1f2937;
      --bg-card-hover: #283548;
      --border: #374151;
      --border-focus: #10b981;
      --primary: #10b981;
      --primary-hover: #059669;
      --accent: #6366f1;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --info: #3b82f6;
      --info-bg: rgba(59, 130, 246, 0.15);
      --sidebar-width: 250px;
      --header-height: 64px;
      --bottom-bar-height: 68px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

    body {
      font-family: 'Heebo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      direction: rtl;
      overflow-x: hidden;
    }

    /* RTL App-Shell Layout */
    .app-shell {
      display: flex;
      min-height: 100vh;
    }

    /* Desktop Sidebar (RTL: pinned to right) */
    .app-sidebar {
      width: var(--sidebar-width);
      background: var(--bg-surface);
      border-left: 1px solid var(--border);
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      z-index: 90;
      transition: transform 0.25s ease;
    }

    .sidebar-header {
      height: var(--header-height);
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
    }

    .brand-title {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.3px;
    }

    .sidebar-nav {
      flex: 1;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      color: var(--text-muted);
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      background: transparent;
      width: 100%;
      text-align: right;
      transition: all 0.18s ease;
      min-height: 44px;
    }

    .nav-item:hover {
      background: var(--bg-card);
      color: var(--text);
    }

    .nav-item.active {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.4);
      color: var(--primary);
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--border);
      font-size: 0.78rem;
      color: var(--text-dim);
      text-align: center;
    }

    /* Main Content Area */
    .app-main {
      flex: 1;
      margin-right: var(--sidebar-width);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Top Navigation Bar */
    .top-bar {
      height: var(--header-height);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 80;
    }

    .top-bar-left, .top-bar-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .page-heading {
      font-size: 1.15rem;
      font-weight: 800;
    }

    .db-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      background: var(--success-bg);
      border: 1px solid var(--success);
      color: var(--success);
    }

    .btn-logout {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      min-height: 40px;
      transition: all 0.2s ease;
    }

    .btn-logout:hover {
      background: var(--danger-bg);
      border-color: var(--danger);
      color: var(--danger);
    }

    /* Container for Views */
    .view-content {
      padding: 24px 20px 80px;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
    }

    /* KPI Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kpi-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .kpi-num {
      font-size: 1.8rem;
      font-weight: 900;
      color: var(--text);
      letter-spacing: -0.5px;
    }

    /* Standard Dashboard Card */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-desc {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 16px;
    }

    /* Explainer Box (Part C) */
    .guide-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 20px;
      position: relative;
    }

    .guide-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      color: #a5b4fc;
      margin-bottom: 8px;
      font-size: 0.95rem;
    }

    .guide-box-body {
      font-size: 0.86rem;
      line-height: 1.6;
      color: #e0e7ff;
    }

    .guide-steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .guide-step {
      background: rgba(17, 24, 39, 0.6);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 8px;
      padding: 10px 12px;
    }

    .guide-step-title {
      font-weight: 700;
      font-size: 0.84rem;
      color: #c7d2fe;
      margin-bottom: 4px;
    }

    /* Forms */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      align-items: flex-end;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .form-input, .form-select {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.9rem;
      padding: 10px 14px;
      min-height: 44px;
      outline: none;
      transition: border-color 0.18s;
      width: 100%;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--border-focus);
    }

    .btn-action {
      background: var(--primary);
      color: #042f2e;
      border: none;
      border-radius: 10px;
      font-weight: 800;
      font-size: 0.9rem;
      padding: 0 20px;
      min-height: 44px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.18s;
    }

    .btn-action:hover {
      background: var(--primary-hover);
    }

    .btn-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
    }

    .btn-secondary:hover {
      background: var(--bg-card-hover);
    }

    /* Badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: none;
    }

    .status-badge.active, .status-badge.approved, .status-badge.success {
      background: var(--success-bg);
      border: 1px solid var(--success);
      color: var(--success);
    }

    .status-badge.disabled, .status-badge.inactive, .status-badge.rejected {
      background: var(--danger-bg);
      border: 1px solid var(--danger);
      color: var(--danger);
    }

    .status-badge.warning, .status-badge.pending, .status-badge.referral_only {
      background: var(--warning-bg);
      border: 1px solid var(--warning);
      color: var(--warning);
    }

    .status-badge.info {
      background: var(--info-bg);
      border: 1px solid var(--info);
      color: var(--info);
    }

    /* LTR Island */
    .ltr-island {
      direction: ltr;
      display: inline-block;
      text-align: left;
      font-family: monospace;
    }

    /* Table Wrappers & Card Responsive */
    .table-container {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-card);
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      text-align: right;
      font-size: 0.88rem;
    }

    .admin-table th {
      background: var(--bg-surface);
      color: var(--text-muted);
      font-weight: 700;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    .admin-table td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(55, 65, 81, 0.5);
      color: var(--text);
    }

    .admin-table tr:last-child td {
      border-bottom: none;
    }

    /* Mobile Responsive Card Rows (<768px) */
    @media (max-width: 768px) {
      .app-sidebar {
        display: none;
      }
      .app-main {
        margin-right: 0;
      }
      .top-bar {
        padding: 0 16px;
      }
      .view-content {
        padding: 16px 12px 90px;
      }

      /* Transform table to cards */
      .responsive-cards table, 
      .responsive-cards thead, 
      .responsive-cards tbody, 
      .responsive-cards th, 
      .responsive-cards td, 
      .responsive-cards tr {
        display: block;
      }

      .responsive-cards thead tr {
        position: absolute;
        top: -9999px;
        left: -9999px;
      }

      .responsive-cards tr {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 12px;
        padding: 12px 14px;
      }

      .responsive-cards td {
        border: none;
        padding: 8px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
        border-bottom: 1px dashed rgba(255,255,255,0.08);
      }

      .responsive-cards td:last-child {
        border-bottom: none;
        padding-top: 12px;
        justify-content: flex-end;
        gap: 8px;
      }

      .responsive-cards td::before {
        content: attr(data-label);
        font-weight: 700;
        color: var(--text-muted);
        text-align: right;
        margin-left: 12px;
      }
    }

    /* Mobile Bottom Navigation Bar (Part B) */
    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--bottom-bar-height);
      background: var(--bg-surface);
      border-top: 1px solid var(--border);
      z-index: 100;
      justify-content: space-around;
      align-items: center;
      padding: 0 4px;
    }

    @media (max-width: 768px) {
      .mobile-bottom-nav {
        display: flex;
      }
    }

    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: var(--text-muted);
      background: transparent;
      border: none;
      font-size: 0.72rem;
      font-weight: 700;
      flex: 1;
      height: 100%;
      min-height: 48px;
      cursor: pointer;
    }

    .bottom-nav-item.active {
      color: var(--primary);
    }

    .bottom-nav-icon {
      font-size: 1.25rem;
    }

    /* Modal System (replaces window.prompt/alert/confirm) */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      transform: translateY(20px);
      transition: transform 0.2s ease;
    }

    .modal-overlay.active .modal-card {
      transform: translateY(0);
    }

    .modal-title {
      font-size: 1.2rem;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .modal-desc {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 18px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    /* Login Screen */
    #login-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      padding: 16px;
    }

    .login-box {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      max-width: 400px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }

    /* Toast */
    #admin-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #047857;
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 12px 24px;
      border-radius: 999px;
      display: none;
      z-index: 4000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>

  <!-- 1. Master Login Overlay -->
  <div id="login-overlay">
    <div class="login-box">
      <div style="font-size: 2.8rem; margin-bottom: 12px;">🍳</div>
      <h2 style="font-size: 1.4rem; font-weight: 900; margin-bottom: 6px;">לוח בקרה וניהול</h2>
      <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 24px;">ספר המתכונים שלי • כניסת מנהל בלבד</p>
      <form onsubmit="handleAdminLogin(event)">
        <div class="form-group" style="text-align: right; margin-bottom: 16px;">
          <label class="form-label">סיסמת ניהול ראשית</label>
          <input type="password" id="admin-password-input" class="form-input" placeholder="הזן סיסמת Master..." required autofocus />
        </div>
        <div id="login-error" style="display: none; background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger); border-radius: 10px; padding: 10px 12px; font-size: 0.88rem; font-weight: 700; margin-bottom: 14px; text-align: right;"></div>
        <button type="submit" id="login-btn" class="btn-action" style="width: 100%;">כניסה למערכת ⚡</button>
      </form>
    </div>
  </div>

  <!-- 2. Responsive App-Shell -->
  <div class="app-shell">

    <!-- Desktop Sidebar (Pinned Right) -->
    <aside class="app-sidebar">
      <div class="sidebar-header">
        <span style="font-size: 1.5rem;">🍳</span>
        <div>
          <div class="brand-title">ספר המתכונים שלי</div>
          <div style="font-size: 0.72rem; color: var(--primary); font-weight: 800;">ADMIN CONTROL</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-item active" data-tab="overview" onclick="switchTab('overview')">
          <span>📊</span> סקירה כללית
        </button>
        <button class="nav-item" data-tab="promos" onclick="switchTab('promos')">
          <span>🎁</span> קופונים והטבות
        </button>
        <button class="nav-item" data-tab="users" onclick="switchTab('users')">
          <span>👥</span> משתמשים ו-VIP
        </button>
        <button class="nav-item" data-tab="trends" onclick="switchTab('trends')">
          <span>🔥</span> גילוי ויראלי
        </button>
        <button class="nav-item" data-tab="growth" onclick="switchTab('growth')">
          <span>🛒</span> צמיחה, רשתות ומוצרים
        </button>
        <button class="nav-item" data-tab="curated" onclick="switchTab('curated')">
          <span>👨‍🍳</span> מתכוני הבעלים וקבוצות
        </button>
      </nav>
      <div class="sidebar-footer">
        גרסה v2.3.7 (Build 56)<br>
        סביבת ייצור ענן
      </div>
    </aside>

    <!-- Main Content Container -->
    <div class="app-main">

      <!-- Top Bar -->
      <header class="top-bar">
        <div class="top-bar-right">
          <span class="page-heading" id="top-bar-heading">סקירה כללית</span>
        </div>
        <div class="top-bar-left">
          <span class="db-status-pill" id="db-status-badge">🟢 Neon DB מחובר</span>
          <button class="btn-logout" onclick="adminLogout()">יציאה 🚪</button>
        </div>
      </header>

      <!-- View 1: Overview -->
      <main id="view-overview" class="view-content">
        <div class="kpi-row">
          <div class="kpi-card">
            <span class="kpi-label">סה״כ משתמשים רשומים</span>
            <span class="kpi-num" id="kpi-users">-</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">מנויי VIP / Pro פעילים</span>
            <span class="kpi-num" id="kpi-pro">-</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">מתכונים בענן Neon</span>
            <span class="kpi-num" id="kpi-recipes">-</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">קודי הטבה פעילים</span>
            <span class="kpi-num" id="kpi-promos">-</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">מיילים ב-VIP Whitelist</span>
            <span class="kpi-num" id="kpi-vips">-</span>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2 class="card-title">⚡ פעולות מהירות למנהל</h2>
          </div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn-action" onclick="switchTab('promos')">🎁 יצירת קופון חדש</button>
            <button class="btn-action btn-secondary" onclick="switchTab('growth')">🛒 בדיקת רשתות מזון</button>
            <button class="btn-action btn-secondary" onclick="switchTab('trends')">🔥 פרסום מתכון לטאב הגילוי</button>
          </div>
        </div>
      </main>

      <!-- View 2: Coupons & Promos -->
      <div id="view-promos" class="view-content" style="display: none;">
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">🎁 יצירת קוד הטבה חדש</h2>
          </div>
          <form onsubmit="handleCreatePromo(event)">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">קוד ההטבה</label>
                <input type="text" id="promo-code" class="form-input" placeholder="למשל: CHEF2026, SUMMER50" required />
              </div>
              <div class="form-group">
                <label class="form-label">סוג הטבה</label>
                <select id="promo-type" class="form-select">
                  <option value="lifetime_pro">Chef Pro לכל החיים (משפחה/שותפים)</option>
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
                <input type="text" id="promo-notes" class="form-input" placeholder="למשל: קבוצת בישול בפייסבוק" />
              </div>
              <button type="submit" class="btn-action">צור קוד ✨</button>
            </div>
          </form>
        </div>

        <div class="card responsive-cards">
          <div class="card-head">
            <h2 class="card-title">קודי הטבה קיימים</h2>
            <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadPromoCodes()">רענן רשימה 🔄</button>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>קוד</th>
                  <th>סוג</th>
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

      <!-- View 3: Users & VIP Whitelist -->
      <div id="view-users" class="view-content" style="display: none;">
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">👑 הוספת כתובת מייל ל-VIP Whitelist</h2>
          </div>
          <p class="card-desc">
            משתמש שכתובת המייל שלו מופיעה ברשימה זו יקבל מיידית מעמד <strong>Chef Pro לכל החיים</strong> ללא הגבלות, ללא צורך בהזנת קוד הטבה.
          </p>
          <form onsubmit="handleAddVipEmail(event)">
            <div class="form-grid">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">כתובת אימייל</label>
                <input type="email" id="vip-email" class="form-input" placeholder="user@gmail.com" required />
              </div>
              <div class="form-group">
                <label class="form-label">הערה / שיוך</label>
                <input type="text" id="vip-notes" class="form-input" placeholder="למשל: אמא, שף אורח" />
              </div>
              <button type="submit" class="btn-action">הוסף ל-VIP 🌟</button>
            </div>
          </form>
        </div>

        <div class="card responsive-cards">
          <div class="card-head">
            <h2 class="card-title">רשימת VIP Whitelist</h2>
            <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadVipEmails()">רענן 🔄</button>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>אימייל</th>
                  <th>שיוך</th>
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

        <div class="card responsive-cards">
          <div class="card-head">
            <h2 class="card-title">👥 משתמשים רשומים במערכת</h2>
            <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadUsers()">רענן 🔄</button>
          </div>
          <div class="table-container">
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

      <!-- View 4: Viral Trends -->
      <div id="view-trends" class="view-content" style="display: none;">
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">🔥 הוספת מתכון ויראלי לגילוי</h2>
          </div>
          <p class="card-desc">
            הזן קישור מכל מקור (אינסטגרם, טיקטוק, פייסבוק, אתר אינטרנט). השרת יחלץ את המתכון ויפרסם אותו מיד לכל המשתמשים בטאב הגילוי (Discovery Feed).
          </p>
          <form onsubmit="handlePublishTrend(event)">
            <div class="form-grid" style="grid-template-columns: 1fr auto;">
              <div class="form-group">
                <label class="form-label">כתובת URL של המתכון</label>
                <input type="url" id="trend-url" class="form-input" placeholder="https://www.instagram.com/reel/... או https://tiktok.com/@..." required />
              </div>
              <button type="submit" id="btn-publish-trend" class="btn-action">חלץ ופרסם לגילוי ✨</button>
            </div>
          </form>
        </div>
      </div>

      <!-- View 5: Growth, Supermarkets & Catalog Auto-Mapping (Parts C & D) -->
      <div id="view-growth" class="view-content" style="display: none;">
        
        <!-- Guided Explanation Box (Part C) -->
        <div class="guide-box">
          <div class="guide-box-header">
            <span>💡 איך עובד מודל ההפניות לרשתות המזון ומיפוי המוצרים?</span>
          </div>
          <div class="guide-box-body">
            כאשר משתמשים צופים במתכונים משותפים, המערכת מציגה כפתור "קנה מצרכים". כדי להבטיח אמינות מוחלטת, כל רשת עוברת תהליך אימות תלת-שלבי:
            <div class="guide-steps">
              <div class="guide-step">
                <div class="guide-step-title">1. מושבתת (Disabled)</div>
                רשת חדשה מתחילה תמיד כמושבתת ולא מופיעה למשתמשים.
              </div>
              <div class="guide-step">
                <div class="guide-step-title">2. בדיקת קישורים (Sample Check)</div>
                המערכת בודקת 3 חיפושים לדוגמה בחנות הרשת לוודא שאין חסימה.
              </div>
              <div class="guide-step">
                <div class="guide-step-title">3. הפניות בלבד (Referral Only)</div>
                מופעלת ומפנה ישירות לחיפוש בחנות הרשת ללא שותפות מסחרית פעילה.
              </div>
            </div>
          </div>
        </div>

        <!-- Funnel Stats -->
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">📊 משפך צמיחה והפניות</h2>
            <div style="display: flex; gap: 8px;">
              <button id="btn-global-kill" class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="toggleGlobalKillSwitch()">⏸️ מתג השבתה גלובלי</button>
              <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadGrowthOverview()">רענן 🔄</button>
            </div>
          </div>
          <div class="kpi-row" style="margin-bottom: 0;">
            <div class="kpi-card"><span class="kpi-label">קישורי שיתוף</span><span class="kpi-num" id="g-shares">0</span></div>
            <div class="kpi-card"><span class="kpi-label">צפיות אנושיות</span><span class="kpi-num" id="g-views">0</span></div>
            <div class="kpi-card"><span class="kpi-label">שמירות מתכון</span><span class="kpi-num" id="g-saves">0</span></div>
            <div class="kpi-card"><span class="kpi-label">הרשמות (התחלה/סיום)</span><span class="kpi-num" id="g-signups">0/0</span></div>
            <div class="kpi-card"><span class="kpi-label">הפניות לחנויות</span><span class="kpi-num" id="g-redirects">0</span></div>
          </div>
        </div>

        <!-- Part D: Automated Supermarket Catalogs & Price Lists -->
        <div class="card responsive-cards">
          <div class="card-head">
            <div>
              <h2 class="card-title">🏬 מחירוני רשתות מזון (שקיפות מחירים)</h2>
              <p class="card-desc" style="margin-bottom: 0;">
                ייבוא אוטומטי של קובצי מחירון רשמיים (<span class="ltr-island">PriceFull</span>) והזנת קטלוג המוצרים למיפוי מצרכים.
              </p>
            </div>
            <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadCatalogStatus()">רענן סטטוס 🔄</button>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>רשת מזון</th>
                  <th>מזהה רשת</th>
                  <th>סניף מועדף</th>
                  <th>סטטוס וסנכרון אחרון</th>
                  <th>מוצרים שנקלטו</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody id="catalogs-table-body">
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">טוען מחירוני רשתות...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Part D: Auto-Mapping Suggestions Review Queue -->
        <div class="card responsive-cards">
          <div class="card-head">
            <div>
              <h2 class="card-title">🤖 תור הצעות למיפוי אוטומטי של מצרכים</h2>
              <p class="card-desc" style="margin-bottom: 0;">
                מצרכים שזוהו אוטומטית מקטלוגי הרשתות וממתינים לאישור מנהל (התאמות מעל 95% מאושרות אוטומטית).
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-action" style="padding: 6px 14px; min-height: 38px;" onclick="approveAllSuggestions()">אשר את כל ההצעות ⚡</button>
              <button class="btn-action btn-secondary" style="padding: 6px 14px; min-height: 38px;" onclick="loadMappingSuggestions()">רענן תור 🔄</button>
            </div>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>מצרך במתכון</th>
                  <th>רשת</th>
                  <th>מוצר מותאם בקטלוג</th>
                  <th>מחיר</th>
                  <th>רמת ביטחון</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody id="suggestions-table-body">
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">אין הצעות ממתינות כרגע 🎉</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Merchants Management Table -->
        <div class="card responsive-cards">
          <div class="card-head">
            <h2 class="card-title">🛒 רשתות מזון נתמכות</h2>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>רשת</th>
                  <th>סטטוס תצוגה</th>
                  <th>מתג השבתה</th>
                  <th>בדיקות קישור</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody id="merchants-table-body">
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">טוען רשימת רשתות...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Manual SKU Mapping Override Layer -->
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">✍️ מיפוי ידני ודריסת מצרכים (Manual Override)</h2>
          </div>
          <p class="card-desc">
            הגדרת מיפוי ידני קבוע עבור מצרך ספציפי. מיפוי ידני "נעול" מונע דריסה על ידי אלגוריתם המיפוי האוטומטי.
          </p>
          <form onsubmit="handleAddSkuMapping(event)">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">מצרך מנורמל</label>
                <input type="text" id="sku-ingredient" class="form-input" placeholder="למשל: שמן זית" required />
              </div>
              <div class="form-group">
                <label class="form-label">רשת מזון</label>
                <select id="sku-merchant" class="form-select">
                  <option value="shufersal">שופרסל אונליין</option>
                  <option value="rami_levy">רמי לוי באינטרנט</option>
                  <option value="hazi_hinam">חצי חינם</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">מק״ט / קוד מוצר (SKU)</label>
                <input type="text" id="sku-code" class="form-input" placeholder="7290000000000" required />
              </div>
              <div class="form-group">
                <label class="form-label">שם מוצר מלא</label>
                <input type="text" id="sku-product-name" class="form-input" placeholder="שמן זית כתית מעולה 750 מ״ל" required />
              </div>
              <div class="form-group">
                <label class="form-label">כתובת מוצר (HTTPS)</label>
                <input type="url" id="sku-url" class="form-input" placeholder="https://www.shufersal.co.il/..." required />
              </div>
              <button type="submit" class="btn-action">שמור מיפוי ידני 💾</button>
            </div>
          </form>

          <div class="table-container responsive-cards" style="margin-top: 18px;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>מצרך</th>
                  <th>חנות</th>
                  <th>מוצר ומק״ט</th>
                  <th>מקור</th>
                  <th>תאריך עדכון</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody id="sku-table-body">
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">אין מיפויים ידניים</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Takedowns Reports -->
        <div class="card responsive-cards">
          <div class="card-head">
            <h2 class="card-title">🚩 דיווחים על תכנים (Takedowns)</h2>
          </div>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>מזהה שיתוף</th>
                  <th>סיבה</th>
                  <th>פרטים</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody id="reports-table-body">
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">אין דיווחים פתוחים 🎉</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Audit Log -->
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">📜 יומן שינויים והפניות אחרונות</h2>
          </div>
          <div id="growth-audit-list" style="font-size: 0.86rem; color: var(--text-muted); line-height: 1.6;">טוען...</div>
        </div>

      </div>

      <!-- TAB 6: CURATED RECIPES & COLLECTIONS (v2.1.0) -->
      <div id="view-curated" style="display: none;">
        <!-- Owner Branding Card -->
        <div class="card" style="margin-bottom: 18px;">
          <div class="card-head">
            <h2 class="card-title">🏷️ מיתוג "מהמטבח של הבעלים"</h2>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
            <input id="curated-owner-name" class="input-field" placeholder="שם הבעלים (למשל: ישי)" />
            <input id="curated-owner-logo" class="input-field" placeholder="טקסט כותרת (למשל: מהמטבח של ישי)" />
            <input id="curated-owner-emoji" class="input-field" placeholder="אייקון (למשל: 👨‍🍳)" />
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button type="button" class="btn-action" onclick="saveCuratedOwnerSettings()">💾 שמור מיתוג</button>
            <button type="button" id="admin-reset-guide-btn" class="btn-action btn-secondary" onclick="resetWelcomeGuideForMe()">🔄 איפוס מדריך פתיחה</button>
          </div>
        </div>

        <!-- Curated Collections Management -->
        <div class="card" style="margin-bottom: 18px;">
          <div class="card-head" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;">
            <h2 class="card-title">🗂️ קבוצות מתכונים (Collections)</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <button type="button" class="btn-action" onclick="openCuratedCollectionEditor()">➕ קבוצה חדשה</button>
              <button type="button" class="btn-action btn-secondary" onclick="publishAllCuratedCollections()">✅ פרסם הכל</button>
            </div>
          </div>
          <div id="admin-curated-collections-list" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">טוען קבוצות...</div>
        </div>

        <!-- Curated Recipes Management -->
        <div class="card" style="margin-bottom: 18px;">
          <div class="card-head" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;">
            <h2 class="card-title">📖 מתכוני הבעלים (Curated Recipes)</h2>
            <button type="button" class="btn-action btn-secondary" onclick="toggleBulkImportPanel()">📥 ייבוא JSON מרוכז</button>
          </div>
          <div id="admin-bulk-import-panel" style="display: none; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin: 12px 0;">
            <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 8px;">הדבק מערך JSON של מתכונים (פורמט StructuredRecipe). ניתן להריץ תצוגה מקדימה ובדיקת שגיאות לפני הייבוא.</p>
            <textarea id="admin-bulk-json-input" rows="5" class="input-field" style="width: 100%; font-family: monospace; direction: ltr; margin-bottom: 10px;" placeholder='[{"title": "...", "ingredients": [...], "instructions": [...]}]'></textarea>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <button type="button" class="btn-action btn-secondary" onclick="runCuratedBulkImport(true)">🔎 תצוגה מקדימה ואימות</button>
              <button type="button" class="btn-action" onclick="runCuratedBulkImport(false)">📥 ייבא מתכונים תקינים</button>
            </div>
            <div id="admin-bulk-import-report" style="margin-top: 10px; font-size: 0.84rem;"></div>
          </div>
          <div id="admin-curated-recipes-list" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">טוען מתכונים...</div>
        </div>
      </div>

    </div>
  </div>

  <!-- Mobile Bottom Navigation (Part B) -->
  <nav class="mobile-bottom-nav">
    <button class="bottom-nav-item active" data-tab="overview" onclick="switchTab('overview')">
      <span class="bottom-nav-icon">📊</span>
      <span>סקירה</span>
    </button>
    <button class="bottom-nav-item" data-tab="promos" onclick="switchTab('promos')">
      <span class="bottom-nav-icon">🎁</span>
      <span>קופונים</span>
    </button>
    <button class="bottom-nav-item" data-tab="users" onclick="switchTab('users')">
      <span class="bottom-nav-icon">👥</span>
      <span>משתמשים</span>
    </button>
    <button class="bottom-nav-item" data-tab="trends" onclick="switchTab('trends')">
      <span class="bottom-nav-icon">🔥</span>
      <span>גילוי</span>
    </button>
    <button class="bottom-nav-item" data-tab="growth" onclick="switchTab('growth')">
      <span class="bottom-nav-icon">🛒</span>
      <span>רשתות</span>
    </button>
    <button class="bottom-nav-item" data-tab="curated" onclick="switchTab('curated')">
      <span class="bottom-nav-icon">👨‍🍳</span>
      <span>קבוצות</span>
    </button>
  </nav>

  <!-- Interactive Modal System (Replaces prompt/alert/confirm) -->
  <div id="modal-container" class="modal-overlay">
    <div class="modal-card">
      <h3 id="modal-title" class="modal-title">כותרת מודאל</h3>
      <p id="modal-desc" class="modal-desc">תוכן מודאל</p>
      <div id="modal-body"></div>
      <div class="modal-actions">
        <button id="modal-btn-cancel" class="btn-action btn-secondary" onclick="closeModal()">ביטול</button>
        <button id="modal-btn-confirm" class="btn-action">אישור</button>
      </div>
    </div>
  </div>

  <!-- Toast Element -->
  <div id="admin-toast"></div>

  <script>
    let adminToken = localStorage.getItem('myrecipes_admin_token') || '';
    let currentGlobalKillSwitch = false;

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function showToast(msg, isError) {
      const el = document.getElementById('admin-toast');
      el.textContent = msg;
      el.style.background = isError ? '#b91c1c' : '#047857';
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 3500);
    }

    // Modal Helpers
    function openModal(title, desc, bodyHtml, onConfirm) {
      const overlay = document.getElementById('modal-container');
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-desc').textContent = desc;
      document.getElementById('modal-body').innerHTML = bodyHtml || '';
      const confirmBtn = document.getElementById('modal-btn-confirm');
      confirmBtn.onclick = async () => {
        if (onConfirm) await onConfirm();
        closeModal();
      };
      overlay.classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal-container').classList.remove('active');
    }

    // App Navigation
    const TAB_HEADINGS = {
      overview: 'סקירה כללית',
      promos: 'קודי הטבה וקופונים',
      users: 'משתמשים ו-VIP Whitelist',
      trends: 'גילוי מתכונים ויראליים',
      growth: 'צמיחה, רשתות ומיפוי מוצרים',
      curated: 'מתכוני הבעלים וקבוצות'
    };

    function switchTab(tabKey) {
      if (!TAB_HEADINGS[tabKey]) tabKey = 'overview';

      // Update headings
      document.getElementById('top-bar-heading').textContent = TAB_HEADINGS[tabKey] || 'לוח בקרה';

      // Update sidebar nav items by data-tab
      document.querySelectorAll('.app-sidebar .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
      });

      // Update mobile bottom nav items by data-tab
      document.querySelectorAll('.mobile-bottom-nav .bottom-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
      });

      // Show view
      ['overview', 'promos', 'users', 'trends', 'growth', 'curated'].forEach(k => {
        const el = document.getElementById('view-' + k);
        if (el) el.style.display = k === tabKey ? 'block' : 'none';
      });

      // Lazy loads
      if (tabKey === 'promos') loadPromoCodes();
      if (tabKey === 'users') { loadVipEmails(); loadUsers(); }
      if (tabKey === 'growth') { loadGrowthOverview(); loadCatalogStatus(); loadMappingSuggestions(); }
      if (tabKey === 'curated') { loadCuratedAdminAll(); }
    }

    // --- v2.1.0 Curated Recipes & Collections Admin Controller ---
    let adminCuratedCollections = [];
    let adminCuratedRecipes = [];

    async function loadCuratedAdminAll() {
      try {
        const [setRes, colRes, recRes] = await Promise.all([
          adminFetch('/api/v1/admin/curated/settings'),
          adminFetch('/api/v1/admin/curated/collections'),
          adminFetch('/api/v1/admin/curated/recipes')
        ]);
        if (setRes.ok) {
          const { settings } = await setRes.json();
          if (settings) {
            const n = document.getElementById('curated-owner-name');
            const l = document.getElementById('curated-owner-logo');
            const e = document.getElementById('curated-owner-emoji');
            if (n) n.value = settings.ownerName || '';
            if (l) l.value = settings.ownerLogoText || '';
            if (e) e.value = settings.ownerBadgeEmoji || '👨‍🍳';
          }
        }
        if (colRes.ok) {
          const data = await colRes.json();
          adminCuratedCollections = Array.isArray(data.collections) ? data.collections : [];
          renderAdminCuratedCollections();
        }
        if (recRes.ok) {
          const data = await recRes.json();
          adminCuratedRecipes = Array.isArray(data.recipes) ? data.recipes : [];
          renderAdminCuratedRecipes();
        }
      } catch (err) {
        showToast('שגיאה בטעינת מתכוני הבעלים וקבוצות', true);
      }
    }

    async function saveCuratedOwnerSettings() {
      const ownerName = document.getElementById('curated-owner-name')?.value || '';
      const ownerLogoText = document.getElementById('curated-owner-logo')?.value || '';
      const ownerBadgeEmoji = document.getElementById('curated-owner-emoji')?.value || '👨‍🍳';
      const res = await adminFetch('/api/v1/admin/curated/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, ownerLogoText, ownerBadgeEmoji })
      });
      if (res.ok) showToast('הגדרות המיתוג נשמרו בהצלחה');
      else showToast('שגיאה בשמירת המיתוג', true);
    }

    function resetWelcomeGuideForMe() {
      try {
        localStorage.removeItem('recipes_welcome_guide_v1');
        localStorage.removeItem('recipes_quest_v2');
        localStorage.removeItem('my_recipes_onboarding_v210');
        showToast('מדריך הפתיחה אופס מקומית! פתח את /app כדי לראות אותו מההתחלה.');
      } catch (e) {
        showToast('שגיאה באיפוס מקומי', true);
      }
    }

    function renderAdminCuratedCollections() {
      const container = document.getElementById('admin-curated-collections-list');
      if (!container) return;
      if (adminCuratedCollections.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);">אין קבוצות עדיין.</div>';
        return;
      }
      container.innerHTML = adminCuratedCollections.map((c, idx) => \`
        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-surface);">
          <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
            <span style="font-size:1.5rem; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:\${esc(c.colorGradient)};">\${esc(c.icon)}</span>
            <div style="min-width:0;">
              <div style="font-weight:800; color:var(--text);">\${esc(c.name)} <span style="font-size:0.75rem; padding:2px 8px; border-radius:999px; background:\${c.published ? 'var(--success-bg)' : 'var(--warning-bg)'}; color:\${c.published ? 'var(--success)' : 'var(--warning)'};">\${c.published ? 'מפורסם' : 'טיוטה'}</span></div>
              <div style="font-size:0.82rem; color:var(--text-muted);">\${esc(c.subtitle || '')} • \${c.recipeCount || 0} מתכונים</div>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="moveCuratedCollection(\${idx}, -1)" \${idx === 0 ? 'disabled' : ''}>⬆️</button>
            <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="moveCuratedCollection(\${idx}, 1)" \${idx === adminCuratedCollections.length - 1 ? 'disabled' : ''}>⬇️</button>
            <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="toggleCuratedCollectionPublish('\${esc(c.id)}', \${!c.published})">\${c.published ? 'הסתר' : 'פרסם'}</button>
            <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="openCuratedCollectionEditor('\${esc(c.id)}')">✏️</button>
            <button class="btn-action btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="deleteCuratedCollection('\${esc(c.id)}')">🗑️</button>
          </div>
        </div>
      \`).join('');
    }

    async function moveCuratedCollection(idx, delta) {
      const target = idx + delta;
      if (target < 0 || target >= adminCuratedCollections.length) return;
      const arr = [...adminCuratedCollections];
      const [moved] = arr.splice(idx, 1);
      arr.splice(target, 0, moved);
      adminCuratedCollections = arr;
      renderAdminCuratedCollections();
      await adminFetch('/api/v1/admin/curated/collections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: arr.map(c => c.id) })
      });
    }

    async function toggleCuratedCollectionPublish(id, published) {
      const res = await adminFetch('/api/v1/admin/curated/collections/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published })
      });
      if (res.ok) { showToast(published ? 'הקבוצה פורסמה!' : 'הקבוצה הוסתרה'); loadCuratedAdminAll(); }
    }

    async function publishAllCuratedCollections() {
      const res = await adminFetch('/api/v1/admin/curated/collections/publish-all', { method: 'POST' });
      if (res.ok) { showToast('כל הקבוצות פורסמו בהצלחה!'); loadCuratedAdminAll(); }
    }

    async function deleteCuratedCollection(id) {
      const res = await adminFetch('/api/v1/admin/curated/collections/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) { showToast('הקבוצה נמחקה (המתכונים נשמרו)'); loadCuratedAdminAll(); }
    }

    function openCuratedCollectionEditor(colId) {
      const existing = colId ? adminCuratedCollections.find(c => c.id === colId) : null;
      const assignedSet = new Set(existing?.recipeIds || []);
      const recipeCheckboxes = adminCuratedRecipes.map(r => \`
        <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; margin-bottom:4px;">
          <input type="checkbox" class="col-assign-rec-cb" value="\${esc(r.id)}" \${assignedSet.has(r.id) ? 'checked' : ''} />
          <span>\${esc(r.recipePayload?.title || r.slug)}</span>
        </label>
      \`).join('');
      const bodyHtml = \`
        <div style="display:flex; flex-direction:column; gap:10px;">
          <input id="edit-col-name" class="input-field" placeholder="שם הקבוצה" value="\${esc(existing?.name || '')}" />
          <input id="edit-col-subtitle" class="input-field" placeholder="כותרת משנה (עד 40 תווים)" value="\${esc(existing?.subtitle || '')}" />
          <input id="edit-col-icon" class="input-field" placeholder="אייקון / אימוג׳י (למשל 🔥)" value="\${esc(existing?.icon || '🍽️')}" />
          <input id="edit-col-gradient" class="input-field" placeholder="צבע / גרדיאנט CSS" value="\${esc(existing?.colorGradient || 'linear-gradient(135deg, #065f46 0%, #10b981 100%)')}" />
          <input id="edit-col-cover" class="input-field" placeholder="קישור תמונת שער (אופציונלי)" value="\${esc(existing?.coverImage || '')}" />
          \${adminCuratedRecipes.length > 0 ? '<div style="max-height:160px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:8px;"><div style="font-weight:700; margin-bottom:6px; font-size:0.82rem;">שייך מתכונים לקבוצה:</div>' + recipeCheckboxes + '</div>' : ''}
        </div>
      \`;
      openModal(existing ? 'עריכת קבוצה' : 'קבוצה חדשה', 'עדכן את פרטי הקבוצה והמתכונים המשויכים', bodyHtml, async () => {
        const recipeIds = Array.from(document.querySelectorAll('.col-assign-rec-cb:checked')).map(el => el.value);
        const payload = {
          name: document.getElementById('edit-col-name')?.value || '',
          subtitle: document.getElementById('edit-col-subtitle')?.value || '',
          icon: document.getElementById('edit-col-icon')?.value || '🍽️',
          colorGradient: document.getElementById('edit-col-gradient')?.value || '',
          coverImage: document.getElementById('edit-col-cover')?.value || null,
          recipeIds
        };
        const url = existing ? ('/api/v1/admin/curated/collections/' + encodeURIComponent(existing.id)) : '/api/v1/admin/curated/collections';
        const method = existing ? 'PUT' : 'POST';
        const res = await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { showToast('הקבוצה נשמרה בהצלחה'); loadCuratedAdminAll(); }
        else showToast('שגיאה בשמירת הקבוצה', true);
      });
    }

    function renderAdminCuratedRecipes() {
      const container = document.getElementById('admin-curated-recipes-list');
      if (!container) return;
      if (adminCuratedRecipes.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);">אין עדיין מתכוני בעלים. ניתן לקדם מתכון מהאפליקציה או לייבא מ-JSON.</div>';
        return;
      }
      const colMap = new Map(adminCuratedCollections.map(c => [c.id, c]));
      container.innerHTML = adminCuratedRecipes.map((r, idx) => {
        const title = r.recipePayload?.title || r.slug;
        const colNames = (r.collectionIds || []).map(cid => colMap.get(cid)?.name).filter(Boolean);
        return \`
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-surface);">
            <div style="min-width:0; flex:1;">
              <div style="font-weight:800; color:var(--text);">\${esc(title)} <span style="font-size:0.75rem; padding:2px 8px; border-radius:999px; background:\${r.published ? 'var(--success-bg)' : 'var(--warning-bg)'}; color:\${r.published ? 'var(--success)' : 'var(--warning)'};">\${r.published ? 'מפורסם' : 'טיוטה'}</span></div>
              <div style="font-size:0.8rem; color:var(--text-muted);">קבוצות: \${colNames.length ? esc(colNames.join(', ')) : 'ללא קבוצה'} • <a href="/r/\${esc(r.slug)}" target="_blank" style="color:var(--primary);">/r/\${esc(r.slug)}</a></div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="moveCuratedRecipe(\${idx}, -1)" \${idx === 0 ? 'disabled' : ''}>⬆️</button>
              <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="moveCuratedRecipe(\${idx}, 1)" \${idx === adminCuratedRecipes.length - 1 ? 'disabled' : ''}>⬇️</button>
              <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="toggleCuratedRecipePublish('\${esc(r.id)}', \${!r.published})">\${r.published ? 'הסתר' : 'פרסם'}</button>
              <button class="btn-action btn-secondary" style="padding:6px 10px;" onclick="openCuratedRecipeEditor('\${esc(r.id)}')">✏️</button>
              <button class="btn-action btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="deleteCuratedRecipe('\${esc(r.id)}')">🗑️</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    async function moveCuratedRecipe(idx, delta) {
      const target = idx + delta;
      if (target < 0 || target >= adminCuratedRecipes.length) return;
      const arr = [...adminCuratedRecipes];
      const [moved] = arr.splice(idx, 1);
      arr.splice(target, 0, moved);
      adminCuratedRecipes = arr;
      renderAdminCuratedRecipes();
      await adminFetch('/api/v1/admin/curated/recipes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: arr.map(r => r.id) })
      });
    }

    async function toggleCuratedRecipePublish(id, published) {
      const res = await adminFetch('/api/v1/admin/curated/recipes/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published })
      });
      if (res.ok) { showToast(published ? 'המתכון פורסם!' : 'המתכון הוסתר'); loadCuratedAdminAll(); }
    }

    async function deleteCuratedRecipe(id) {
      const res = await adminFetch('/api/v1/admin/curated/recipes/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) { showToast('המתכון נמחק מהמאגר המומלץ'); loadCuratedAdminAll(); }
    }

    function openCuratedRecipeEditor(recId) {
      const rec = adminCuratedRecipes.find(r => r.id === recId);
      if (!rec) return;
      const assigned = new Set(rec.collectionIds || []);
      const colChecks = adminCuratedCollections.map(c => \`
        <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; margin-bottom:4px;">
          <input type="checkbox" class="rec-assign-col-cb" value="\${esc(c.id)}" \${assigned.has(c.id) ? 'checked' : ''} />
          <span>\${esc(c.icon)} \${esc(c.name)}</span>
        </label>
      \`).join('');
      const bodyHtml = \`
        <div style="display:flex; flex-direction:column; gap:10px;">
          <input id="edit-cur-rec-title" class="input-field" value="\${esc(rec.recipePayload?.title || '')}" placeholder="שם המתכון" />
          <input id="edit-cur-rec-cover" class="input-field" value="\${esc(rec.coverImage || '')}" placeholder="תמונת שער" />
          <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:8px;">
            <div style="font-weight:700; margin-bottom:6px; font-size:0.82rem;">שייך לקבוצות:</div>
            \${colChecks}
          </div>
        </div>
      \`;
      openModal('עריכת מתכון מומלץ', 'ערוך כותרת, תמונה ושיוך לקבוצות', bodyHtml, async () => {
        const collectionIds = Array.from(document.querySelectorAll('.rec-assign-col-cb:checked')).map(el => el.value);
        const title = document.getElementById('edit-cur-rec-title')?.value || rec.recipePayload?.title;
        const coverImage = document.getElementById('edit-cur-rec-cover')?.value || null;
        const res = await adminFetch('/api/v1/admin/curated/recipes/' + encodeURIComponent(rec.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipePayload: { ...rec.recipePayload, title, imageUrl: coverImage },
            coverImage,
            collectionIds
          })
        });
        if (res.ok) { showToast('המתכון עודכן בהצלחה'); loadCuratedAdminAll(); }
        else showToast('שגיאה בעדכון המתכון', true);
      });
    }

    function toggleBulkImportPanel() {
      const p = document.getElementById('admin-bulk-import-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    }

    async function runCuratedBulkImport(dryRun) {
      const raw = document.getElementById('admin-bulk-json-input')?.value || '';
      const reportEl = document.getElementById('admin-bulk-import-report');
      let items;
      try {
        items = JSON.parse(raw);
        if (!Array.isArray(items)) throw new Error('JSON must be an array');
      } catch (e) {
        if (reportEl) reportEl.innerHTML = '<span style="color:var(--danger);">שגיאת JSON: ' + esc(e.message) + '</span>';
        return;
      }
      const res = await adminFetch('/api/v1/admin/curated/recipes/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, dryRun })
      });
      const data = await res.json();
      if (!res.ok) {
        if (reportEl) reportEl.innerHTML = '<span style="color:var(--danger);">' + esc(data.error || 'Import failed') + '</span>';
        return;
      }
      if (reportEl) {
        reportEl.innerHTML = \`<div><strong>\${dryRun ? 'תצוגה מקדימה' : 'יובאו בהצלחה'}:</strong> תקינים: \${data.validCount} | שגיאות: \${data.errorCount}</div>\` +
          (data.preview || []).map(p => \`<div style="color:\${p.valid ? 'var(--success)' : 'var(--danger)'};">#\${p.index} \${esc(p.title)} — \${p.valid ? 'תקין' : esc(p.error)}</div>\`).join('');
      }
      if (!dryRun) {
        showToast('יובאו ' + (data.importedIds?.length || 0) + ' מתכונים מומלצים');
        loadCuratedAdminAll();
      }
    }

    // Auth & API fetch wrapper
    async function adminFetch(url, options = {}) {
      options.headers = options.headers || {};
      if (adminToken) {
        options.headers['Authorization'] = 'Bearer ' + adminToken;
        options.headers['x-admin-token'] = adminToken;
      }
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        adminLogout();
      }
      return res;
    }

    async function handleAdminLogin(e) {
      e.preventDefault();
      const inputEl = document.getElementById('admin-password-input');
      const pass = inputEl ? inputEl.value : '';
      const btn = document.getElementById('login-btn');
      btn.textContent = 'מאמת סיסמה...';
      btn.disabled = true;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch('/api/v1/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.token) {
          adminToken = data.token;
          localStorage.setItem('myrecipes_admin_token', adminToken);
          document.getElementById('login-overlay').style.display = 'none';
          showToast('ברוך הבא ללוח הניהול! 🍳');
          refreshAll();
        } else {
          const errEl = document.getElementById('login-error');
          if (res.status === 429) {
            errEl.textContent = 'יותר מדי ניסיונות, נסה שוב בעוד דקה';
          } else {
            errEl.textContent = data.error || 'סיסמת ניהול שגויה';
          }
          errEl.style.display = 'block';
        }
      } catch (err) {
        clearTimeout(timeoutId);
        showToast(err && err.name === 'AbortError' ? 'חריגת זמן בחיבור לשרת' : 'שגיאת תקשורת עם השרת', true);
      } finally {
        btn.textContent = 'כניסה למערכת ⚡';
        btn.disabled = false;
      }
    }

    function adminLogout() {
      adminToken = '';
      localStorage.removeItem('myrecipes_admin_token');
      document.getElementById('login-overlay').style.display = 'flex';
    }

    // Data Loaders
    async function refreshAll() {
      await loadStats();
      await loadPromoCodes();
    }

    async function loadStats() {
      try {
        const res = await adminFetch('/api/v1/admin/stats');
        if (res.ok) {
          const s = await res.json();
          const totalUsers = s.totalUsers ?? s.usersCount ?? 0;
          const proUsers = s.proUsers ?? s.proUsersCount ?? 0;
          const totalRecipes = s.totalRecipes ?? s.recipesCount ?? 0;
          const activePromos = s.activePromoCodes ?? s.activePromoCodesCount ?? 0;
          const vipEmails = s.vipEmailsCount ?? 0;

          document.getElementById('kpi-users').textContent = String(totalUsers);
          document.getElementById('kpi-pro').textContent = String(proUsers);
          document.getElementById('kpi-recipes').textContent = String(totalRecipes);
          document.getElementById('kpi-promos').textContent = String(activePromos);
          document.getElementById('kpi-vips').textContent = String(vipEmails);
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
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">אין קודי הטבה פעילים</td></tr>';
            return;
          }
          tbody.innerHTML = codes.map(c => \`
            <tr>
              <td data-label="קוד"><strong class="ltr-island">\${esc(c.code)}</strong></td>
              <td data-label="סוג">\${esc(c.discountType)}</td>
              <td data-label="שימושים">\${c.usedCount} / \${c.maxUses || '∞'}</td>
              <td data-label="סטטוס"><span class="status-badge \${c.isActive ? 'active' : 'inactive'}">\${c.isActive ? 'פעיל' : 'מושהה'}</span></td>
              <td data-label="הערות">\${esc(c.notes || '-')}</td>
              <td data-label="נוצר בתאריך">\${new Date(c.createdAt).toLocaleDateString('he-IL')}</td>
              <td data-label="פעולות">
                <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px;" onclick="togglePromo('\${c.code}', \${!c.isActive})">\${c.isActive ? 'השהה' : 'הפעל'}</button>
                <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px; color: var(--danger);" onclick="deletePromo('\${c.code}')">🗑️</button>
              </td>
            </tr>\`).join('');
        }
      } catch (e) {}
    }

    async function handleCreatePromo(e) {
      e.preventDefault();
      const code = document.getElementById('promo-code').value.trim();
      const discountType = document.getElementById('promo-type').value;
      const maxUses = parseInt(document.getElementById('promo-max').value) || undefined;
      const notes = document.getElementById('promo-notes').value.trim();

      try {
        const res = await adminFetch('/api/v1/admin/promo-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, discountType, maxUses, notes })
        });
        if (res.ok) {
          showToast('קוד ההטבה נוצר בהצלחה! ✨');
          e.target.reset();
          loadPromoCodes();
          loadStats();
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'שגיאה ביצירת קוד', true);
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
        loadPromoCodes();
        loadStats();
      } catch (e) {}
    }

    async function deletePromo(code) {
      openModal('מחיקת קוד הטבה', 'האם אתה בטוח שברצונך למחוק לצמיתות את הקוד ' + code + '?', '', async () => {
        await adminFetch('/api/v1/admin/promo-codes/' + encodeURIComponent(code), { method: 'DELETE' });
        showToast('קוד ההטבה נמחק');
        loadPromoCodes();
        loadStats();
      });
    }

    async function loadVipEmails() {
      const tbody = document.getElementById('vip-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/vip-emails');
        if (res.ok) {
          const data = await res.json();
          const list = data.emails || [];
          if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">אין מיילים ברשימת VIP</td></tr>';
            return;
          }
          tbody.innerHTML = list.map(v => \`
            <tr>
              <td data-label="אימייל"><strong class="ltr-island">\${esc(v.email)}</strong></td>
              <td data-label="שיוך"><span class="status-badge warning">\${esc(v.tier)}</span></td>
              <td data-label="הערות">\${esc(v.notes || '-')}</td>
              <td data-label="תאריך">\${new Date(v.createdAt).toLocaleDateString('he-IL')}</td>
              <td data-label="פעולות">
                <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px; color: var(--danger);" onclick="deleteVipEmail('\${v.email}')">🗑️ הסר</button>
              </td>
            </tr>\`).join('');
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
          e.target.reset();
          loadVipEmails();
          loadStats();
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'שגיאה בהוספת מייל', true);
        }
      } catch (e) {}
    }

    async function deleteVipEmail(email) {
      openModal('הסרת VIP', 'להסיר את כתובת המייל ' + email + ' מרשימת ה-VIP?', '', async () => {
        await adminFetch('/api/v1/admin/vip-emails/' + encodeURIComponent(email), { method: 'DELETE' });
        showToast('המייל הוסר מרשימת ה-VIP');
        loadVipEmails();
        loadStats();
      });
    }

    async function loadUsers() {
      const tbody = document.getElementById('users-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/users');
        if (res.ok) {
          const data = await res.json();
          const users = data.users || [];
          if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">אין משתמשים רשומים</td></tr>';
            return;
          }
          tbody.innerHTML = users.map(u => \`
            <tr>
              <td data-label="שם / מזהה"><strong>\${esc(u.name || u.id)}</strong></td>
              <td data-label="אימייל" class="ltr-island">\${esc(u.email)}</td>
              <td data-label="סטטוס Pro"><span class="status-badge \${u.isPro ? 'active' : 'inactive'}">\${u.isPro ? 'Pro פעיל 👑' : 'חינם'}</span></td>
              <td data-label="סוג מנוי">\${esc(u.proTier || 'free')}</td>
              <td data-label="תאריך">\${new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
              <td data-label="פעולות">
                <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px;" onclick="toggleUserPro('\${u.id}', \${!u.isPro})">\${u.isPro ? 'שנמך לחינם' : 'שדרג ל-Pro 🌟'}</button>
              </td>
            </tr>\`).join('');
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
        loadUsers();
        loadStats();
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
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const data = await res.json();
          showToast('המתכון "' + (data.recipe?.title || 'החדש') + '" פורסם בהצלחה לטאב הגילוי! 🎉');
          e.target.reset();
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'שגיאה בחילוץ ופרסום', true);
        }
      } catch (err) {
        showToast('שגיאת תקשורת עם השרת', true);
      } finally {
        btn.textContent = 'חלץ ופרסם לגילוי ✨';
        btn.disabled = false;
      }
    }

    // Growth & Supermarkets (Part C & D)
    async function loadGrowthOverview() {
      try {
        const res = await adminFetch('/api/v1/admin/growth-overview');
        if (!res.ok) return;
        const data = await res.json();
        const f = data.funnel || {};
        document.getElementById('g-shares').textContent = String(f.shareCreated || 0);
        document.getElementById('g-views').textContent = String(f.shareViews || 0);
        document.getElementById('g-saves').textContent = (f.sharedRecipeSaved || 0) + ' (' + ((f.savesPerViewRatio || 0) * 100).toFixed(1) + '%)';
        document.getElementById('g-signups').textContent = (f.signupStarted || 0) + '/' + (f.signupCompleted || 0);
        document.getElementById('g-redirects').textContent = String(f.affiliateRedirects || 0);

        currentGlobalKillSwitch = Boolean(data.globalKillSwitch);
        const gkBtn = document.getElementById('btn-global-kill');
        if (gkBtn) {
          gkBtn.textContent = currentGlobalKillSwitch ? '▶️ הפעל מחדש הפניות (מכובה כעת)' : '⏸️ מתג השבתה גלובלי (פעיל)';
        }

        const checks = data.sampleChecks || [];
        const merchBody = document.getElementById('merchants-table-body');
        merchBody.innerHTML = (data.merchants || []).map(m => {
          const mChecks = checks.filter(c => c.merchantId === m.id && c.passed);
          const hasPassedChecks = mChecks.length > 0;
          return \`
            <tr>
              <td data-label="רשת"><strong>\${esc(m.displayName)}</strong><br><small class="ltr-island" style="color:var(--text-muted);">\${esc(m.id)}</small></td>
              <td data-label="סטטוס"><span class="status-badge \${m.status === 'referral_only' ? 'referral_only' : 'disabled'}">\${m.status === 'referral_only' ? 'הפניות פעילות' : 'מושבת'}</span></td>
              <td data-label="מתג השבתה"><button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px;" onclick="toggleMerchantKill('\${esc(m.id)}', \${!m.killSwitch})">\${m.killSwitch ? 'הפעל חנות' : 'השבת'}</button></td>
              <td data-label="בדיקות קישור"><span class="status-badge \${hasPassedChecks ? 'success' : 'warning'}">\${mChecks.length} תקינות</span></td>
              <td data-label="פעולות">
                <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px;" onclick="promptSampleCheckModal('\${esc(m.id)}')">🧪 בדיקת קישורים</button>
                <button class="btn-action" style="padding: 4px 10px; min-height: 32px;" \${!hasPassedChecks && m.status !== 'referral_only' ? 'disabled title="יש להריץ בדיקת קישורים תחילה"' : ''} onclick="updateMerchantStatus('\${esc(m.id)}', '\${m.status === 'referral_only' ? 'disabled' : 'referral_only'}')">\${m.status === 'referral_only' ? 'השבת' : 'הפעל הפניות'}</button>
              </td>
            </tr>\`;
        }).join('');

        const skuBody = document.getElementById('sku-table-body');
        skuBody.innerHTML = (data.mappings || []).length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">אין מיפויים ידניים</td></tr>'
          : data.mappings.map(mp => \`
              <tr>
                <td data-label="מצרך"><strong>\${esc(mp.normalizedName)}</strong></td>
                <td data-label="חנות">\${esc(mp.merchantId)}</td>
                <td data-label="מוצר ומק״ט">\${esc(mp.productName)} (<span class="ltr-island">\${esc(mp.sku)}</span>)</td>
                <td data-label="מקור"><span class="status-badge \${mp.source === 'auto' ? 'info' : 'active'}">\${mp.source === 'auto' ? 'אוטומטי' : 'ידני נעול'}</span></td>
                <td data-label="עדכון">\${esc((mp.verifiedAt || '').slice(0,10))}</td>
                <td data-label="פעולות"><button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px; color: var(--danger);" onclick="deleteSkuMapping('\${esc(mp.id)}')">🗑️</button></td>
              </tr>\`).join('');

        const repBody = document.getElementById('reports-table-body');
        repBody.innerHTML = (data.reports || []).length === 0
          ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">אין דיווחים פתוחים 🎉</td></tr>'
          : data.reports.map(r => \`
              <tr>
                <td data-label="שיתוף"><code class="ltr-island">\${esc(r.shareId)}</code></td>
                <td data-label="סיבה">\${esc(r.reason)}</td>
                <td data-label="פרטים">\${esc(r.details || '-')}</td>
                <td data-label="סטטוס"><span class="status-badge \${r.status === 'open' ? 'disabled' : 'active'}">\${esc(r.status)}</span></td>
                <td data-label="פעולות">
                  \${r.status === 'open'
                    ? \`<button class="btn-action btn-secondary" style="padding: 4px 8px; min-height: 30px; color: var(--danger);" onclick="resolveReport('\${esc(r.id)}', 'revoke')">🚫 בטל והסר</button> <button class="btn-action btn-secondary" style="padding: 4px 8px; min-height: 30px;" onclick="resolveReport('\${esc(r.id)}', 'dismiss')">דחה</button>\`
                    : 'טופל'}
                </td>
              </tr>\`).join('');

        const auditHtml = (data.auditLogs || []).slice(0, 10).map(a =>
          '<div style="padding:4px 0;border-bottom:1px solid var(--border);">[' + esc(a.createdAt.slice(0,19)) + '] <strong>' + esc(a.merchantId) + '</strong>: ' + esc(a.action) + '</div>'
        ).join('');
        document.getElementById('growth-audit-list').innerHTML = auditHtml || '<div>אין שינויים מתועדים עדיין</div>';
      } catch (e) {}
    }

    // Part D: Supermarket Catalogs & Price List Status
    async function loadCatalogStatus() {
      const tbody = document.getElementById('catalogs-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/catalog/status');
        if (!res.ok) return;
        const data = await res.json();
        const chains = data.chains || [];
        tbody.innerHTML = chains.map(c => {
          const isDefunct = !c.enabled;
          const statusBadge = isDefunct
            ? '<span class="status-badge disabled">⚪ מושבת</span>'
            : (c.lastRun?.status === 'success'
                ? '<span class="status-badge active">🟢 נקלט בהצלחה</span>'
                : (c.lastRun?.status === 'failed'
                    ? '<span class="status-badge disabled">🔴 נכשל</span>'
                    : '<span class="status-badge pending">🟡 ממתין לקליטה</span>'));

          const notesHtml = c.notes
            ? \`<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">\${esc(c.notes)}</div>\`
            : '';

          const fileInfo = c.lastFile
            ? \`<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px; word-break: break-all;" class="ltr-island">\${esc(c.lastFile)}</div>\`
            : '';

          return \`
          <tr style="\${isDefunct ? 'opacity: 0.8;' : ''}">
            <td data-label="רשת מזון">
              <strong>\${esc(c.chainName)}</strong>
              \${notesHtml}
            </td>
            <td data-label="מזהה רשת" class="ltr-island">\${esc(c.chainId)}</td>
            <td data-label="סניף מועדף">
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="text" id="store-\${esc(c.chainKey)}" value="\${esc(c.preferredStoreId || '')}" style="width: 55px; padding: 3px 6px; font-size: 12px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--text);" placeholder="סניף" \${isDefunct ? 'disabled' : ''} />
                <button class="btn-action btn-secondary" style="padding: 2px 6px; font-size: 11px; min-height: 26px;" onclick="saveChainStore('\${esc(c.chainKey)}')" \${isDefunct ? 'disabled' : ''} title="שמור סניף">💾</button>
              </div>
            </td>
            <td data-label="סטטוס">
              \${statusBadge}
              \${fileInfo}
            </td>
            <td data-label="מוצרים שנקלטו"><strong>\${Number(c.totalProducts || c.lastRun?.rowsImported || 0).toLocaleString()}</strong></td>
            <td data-label="פעולות" style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-action" style="padding: 4px 10px; min-height: 32px;" onclick="syncChainCatalog('\${esc(c.chainKey)}')" \${isDefunct ? 'disabled style="opacity: 0.5;"' : ''}>סנכרן עכשיו 🔄</button>
              <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px;" onclick="importFromUrlPrompt('\${esc(c.chainKey)}')" \${isDefunct ? 'disabled style="opacity: 0.5;"' : ''}>🌐 ייבוא מקישור</button>
              <label class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px; cursor: pointer; display: inline-flex; align-items: center; \${isDefunct ? 'opacity: 0.5; pointer-events: none;' : ''}">
                📁 העלה קובץ
                <input type="file" accept=".gz,.xml" style="display: none;" onchange="handleSmartPriceFileUpload(event, '\${esc(c.chainKey)}')" />
              </label>
            </td>
          </tr>\`;
        }).join('');
      } catch (e) {}
    }

    async function saveChainStore(chainKey) {
      const input = document.getElementById('store-' + chainKey);
      const storeId = input ? input.value.trim() : '';
      if (!storeId) return showToast('נא להזין מספר סניף', true);

      try {
        const res = await adminFetch('/api/v1/admin/catalog/config/' + encodeURIComponent(chainKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredStoreId: storeId })
        });
        if (res.ok) {
          showToast('סניף מועדף נשמר בהצלחה (' + storeId + ') 💾');
        } else {
          showToast('שגיאה בשמירת סניף מועדף', true);
        }
      } catch {
        showToast('שגיאה בתקשורת', true);
      }
    }

    async function syncChainCatalog(chainKey) {
      const storeInput = document.getElementById('store-' + chainKey);
      const storeId = storeInput ? storeInput.value.trim() : undefined;

      showToast('מתחיל סנכרון מחירון ישירות מפורטל הרשת... ⏳');
      try {
        const res = await adminFetch('/api/v1/admin/catalog/import/' + encodeURIComponent(chainKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: storeId })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.result?.skipped) {
            showToast('הרשת סומנה כמושבתת: ' + data.result.reason, false);
          } else {
            showToast('המחירון סונכרן ונקלט בהצלחה! (' + (data.result?.rowsImported || 0) + ' מוצרים) 🎉');
          }
          loadCatalogStatus();
          loadMappingSuggestions();
        } else {
          showToast(data.error || 'שגיאה בסנכרון מחירון', true);
        }
      } catch (e) {
        showToast('שגיאה בסנכרון', true);
      }
    }

    // Alias for backward compatibility
    const refreshChainCatalog = syncChainCatalog;

    async function importFromUrlPrompt(chainKey) {
      const url = prompt('הזן כתובת מלאה לקובץ המחירון (לדוגמה קובץ Azure Blob של חצי חינם או שופרסל):');
      if (!url || !url.trim()) return;

      const storeInput = document.getElementById('store-' + chainKey);
      const storeId = storeInput ? storeInput.value.trim() : undefined;

      showToast('מוריד ומייבא מחירון ישירות מהכתובת... ⏳');
      try {
        const res = await adminFetch('/api/v1/admin/catalog/import/' + encodeURIComponent(chainKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), storeId: storeId })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('המחירון נסרק ונקלט בהצלחה מכתובת ה-URL! (' + (data.result?.rowsImported || 0) + ' מוצרים) 🎉');
          loadCatalogStatus();
          loadMappingSuggestions();
        } else {
          showToast(data.error || 'שגיאה בייבוא המחירון מהכתובת', true);
        }
      } catch (e) {
        showToast('שגיאה בייבוא מהכתובת', true);
      }
    }

    async function handleSmartPriceFileUpload(event, chainKey) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const isGzip = file.name.endsWith('.gz');
      const storeInput = document.getElementById('store-' + chainKey);
      const storeId = storeInput ? storeInput.value.trim() : undefined;
      const CHUNK_SIZE = 2.5 * 1024 * 1024; // 2.5MB per chunk (safely under Vercel 4.5MB limit)

      if (file.size <= CHUNK_SIZE) {
        showToast('מעלה ומפענח קובץ מחירון עבור הרשת... ⏳');
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Content = (reader.result || '').split(',')[1] || '';
            const res = await adminFetch('/api/v1/admin/catalog/upload/' + encodeURIComponent(chainKey), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: base64Content,
                isGzip: isGzip,
                fileName: file.name,
                storeId: storeId
              })
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              showToast('קובץ המחירון נקלט בהצלחה! (' + (data.result?.rowsImported || 0) + ' מוצרים) 🎉');
              loadCatalogStatus();
              loadMappingSuggestions();
            } else {
              showToast(data.error || 'שגיאה בפענוח קובץ המחירון', true);
            }
          } catch (err) {
            showToast('שגיאה בהעלאת הקובץ לשרת', true);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      // Multi-chunk upload for large files
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      showToast('קובץ גדול (' + (file.size / (1024 * 1024)).toFixed(1) + 'MB). מעלה ב-' + totalChunks + ' מקטעים... ⏳');

      try {
        for (let index = 0; index < totalChunks; index++) {
          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(start, end);

          const chunkBase64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve((r.result || '').split(',')[1] || '');
            r.onerror = reject;
            r.readAsDataURL(chunkBlob);
          });

          showToast('מעלה מקטע ' + (index + 1) + ' מתוך ' + totalChunks + '... ⏳');

          const res = await adminFetch('/api/v1/admin/catalog/upload/' + encodeURIComponent(chainKey) + '/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId: uploadId,
              index: index,
              totalChunks: totalChunks,
              data: chunkBase64,
              isGzip: isGzip,
              fileName: file.name,
              storeId: storeId
            })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || ('שגיאה בהעלאת מקטע ' + (index + 1)));
          }

          if (index === totalChunks - 1) {
            const data = await res.json();
            showToast('כל המקטעים נקלטו ועובדו בהצלחה! (' + (data.result?.rowsImported || 0) + ' מוצרים) 🎉');
            loadCatalogStatus();
            loadMappingSuggestions();
          }
        }
      } catch (err) {
        showToast(err.message || 'שגיאה בהעלאת מקטעי הקובץ', true);
      }
    }

    // Part D: Mapping Suggestions Queue
    async function loadMappingSuggestions() {
      const tbody = document.getElementById('suggestions-table-body');
      try {
        const res = await adminFetch('/api/v1/admin/catalog/suggestions');
        if (!res.ok) return;
        const data = await res.json();
        const suggestions = data.suggestions || [];
        if (suggestions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">אין הצעות ממתינות כרגע 🎉</td></tr>';
          return;
        }
        tbody.innerHTML = suggestions.map(s => \`
          <tr>
            <td data-label="מצרך במתכון"><strong>\${esc(s.ingredientName)}</strong></td>
            <td data-label="רשת">\${esc(s.chain)}</td>
            <td data-label="מוצר בקטלוג">\${esc(s.productName)}</td>
            <td data-label="מחיר">\${esc(s.price || '-')} ₪</td>
            <td data-label="רמת ביטחון"><span class="status-badge \${s.confidence >= 90 ? 'active' : 'warning'}">\${s.confidence}% (\${esc(s.method)})</span></td>
            <td data-label="פעולות">
              <button class="btn-action" style="padding: 4px 10px; min-height: 32px;" onclick="approveSuggestion('\${esc(s.id)}')">אשר ✓</button>
              <button class="btn-action btn-secondary" style="padding: 4px 10px; min-height: 32px; color: var(--danger);" onclick="rejectSuggestion('\${esc(s.id)}')">דחה ✗</button>
            </td>
          </tr>\`).join('');
      } catch (e) {}
    }

    async function approveSuggestion(id) {
      const res = await adminFetch('/api/v1/admin/catalog/suggestions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: [id] })
      });
      if (res.ok) {
        showToast('המיפוי אושר ונשמר בהצלחה! ✨');
        loadMappingSuggestions();
        loadGrowthOverview();
      }
    }

    async function approveAllSuggestions() {
      openModal('אישור גורף', 'האם אתה בטוח שברצונך לאשר את כל המיפויים הממתינים בתור?', '', async () => {
        const rows = document.querySelectorAll('#suggestions-table-body button[onclick^="approveSuggestion"]');
        const ids = Array.from(rows).map(b => b.getAttribute('onclick').match(/'([^']+)'/)?.[1]).filter(Boolean);
        if (ids.length === 0) return;
        const res = await adminFetch('/api/v1/admin/catalog/suggestions/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggestionIds: ids })
        });
        if (res.ok) {
          showToast('כל המיפויים אושרו בהצלחה! ⚡');
          loadMappingSuggestions();
          loadGrowthOverview();
        }
      });
    }

    async function rejectSuggestion(id) {
      const res = await adminFetch('/api/v1/admin/catalog/suggestions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: id })
      });
      if (res.ok) {
        showToast('ההצעה נדחתה');
        loadMappingSuggestions();
      }
    }

    // Modal-based Sample Check (Replacing window.prompt)
    function promptSampleCheckModal(merchantId) {
      const bodyHtml = \`
        <div class="form-group" style="text-align: right;">
          <label class="form-label">הזן לפחות 3 מצרכים בעברית (מופרדים בפסיקים):</label>
          <input type="text" id="modal-sample-input" class="form-input" value="שמן זית, חלב 3%, עגבניות שרי" />
        </div>\`;
      openModal('בדיקת קישורים לדוגמה (Sample Check)', 'המערכת תבצע בדיקת תקינות לקישורי הרשת כדי לוודא שאין חסימות.', bodyHtml, async () => {
        const raw = document.getElementById('modal-sample-input').value;
        const testedQueries = raw.split(',').map(s => s.trim()).filter(Boolean);
        const res = await adminFetch('/api/v1/admin/merchants/' + encodeURIComponent(merchantId) + '/sample-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testedQueries })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { showToast(data.error || 'הבדיקה נכשלה', true); return; }
        showToast('בדיקת הקישורים עברה בהצלחה! ניתן להפעיל הפניות לרשת 🎉');
        loadGrowthOverview();
      });
    }

    async function updateMerchantStatus(merchantId, status) {
      const res = await adminFetch('/api/v1/admin/merchants/' + encodeURIComponent(merchantId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast('סטטוס החנות עודכן בהצלחה');
        loadGrowthOverview();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'לא ניתן לעדכן סטטוס', true);
      }
    }

    async function toggleMerchantKill(merchantId, killSwitch) {
      const res = await adminFetch('/api/v1/admin/merchants/' + encodeURIComponent(merchantId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killSwitch })
      });
      if (res.ok) {
        showToast('מתג ההשבתה עודכן');
        loadGrowthOverview();
      }
    }

    async function toggleGlobalKillSwitch() {
      const res = await adminFetch('/api/v1/admin/referrals/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentGlobalKillSwitch })
      });
      if (res.ok) {
        showToast('מתג השבתה גלובלי עודכן');
        loadGrowthOverview();
      }
    }

    async function handleAddSkuMapping(e) {
      e.preventDefault();
      const body = {
        normalizedName: document.getElementById('sku-ingredient').value.trim(),
        merchantId: document.getElementById('sku-merchant').value,
        sku: document.getElementById('sku-code').value.trim(),
        productName: document.getElementById('sku-product-name').value.trim(),
        productUrl: document.getElementById('sku-url').value.trim(),
      };
      const res = await adminFetch('/api/v1/admin/ingredient-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast('מיפוי ידני נעול נשמר בהצלחה! 🔒');
        e.target.reset();
        loadGrowthOverview();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'שגיאה בשמירת מיפוי', true);
      }
    }

    async function deleteSkuMapping(id) {
      openModal('מחיקת מיפוי ידני', 'האם אתה בטוח שברצונך למחוק מיפוי זה?', '', async () => {
        await adminFetch('/api/v1/admin/ingredient-mappings/' + encodeURIComponent(id), { method: 'DELETE' });
        showToast('המיפוי נמחק');
        loadGrowthOverview();
      });
    }

    async function resolveReport(reportId, action) {
      const res = await adminFetch('/api/v1/admin/share-reports/' + encodeURIComponent(reportId) + '/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        showToast(action === 'revoke' ? 'הקישור בוטל והוסר' : 'הדיווח טופל');
        loadGrowthOverview();
      }
    }

    // Init on load
    window.onload = () => {
      if (adminToken) {
        document.getElementById('login-overlay').style.display = 'none';
        refreshAll();
      }
    };
  </script>
</body>
</html>
`;
}
