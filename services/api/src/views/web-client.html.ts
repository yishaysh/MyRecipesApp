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

    /* Kitchen Mode Entry Button */
    .kitchen-mode-btn {
      width: 100%;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      border: none;
      border-radius: 16px;
      padding: 14px 18px;
      margin: 12px 0 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      text-align: right;
    }

    .kitchen-mode-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.38);
    }

    .kitchen-mode-btn:active {
      transform: scale(0.99);
    }

    .kitchen-mode-btn-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: right;
    }

    .kitchen-mode-btn-title {
      font-size: 1.15rem;
      font-weight: 800;
      line-height: 1.3;
    }

    .kitchen-mode-btn-sub {
      font-size: 0.8rem;
      color: #a7f3d0;
      margin-top: 2px;
    }

    .kitchen-mode-btn-arrow {
      font-size: 1.5rem;
      font-weight: 800;
      opacity: 0.85;
      margin-right: 8px;
    }

    /* Kitchen Mode Fullscreen Modal */
    .kitchen-modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      direction: rtl;
      text-align: right;
      animation: fadeInModal 0.2s ease-out;
    }

    @keyframes fadeInModal {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .kitchen-modal-inner {
      max-width: 680px;
      width: 100%;
      margin: 0 auto;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px 20px;
      padding-top: max(16px, env(safe-area-inset-top));
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      box-sizing: border-box;
    }

    .kitchen-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .kitchen-close-btn {
      background: transparent;
      border: none;
      color: #ef4444;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background 0.15s;
      font-family: inherit;
    }

    .kitchen-close-btn:hover {
      background: #fee2e2;
    }

    .kitchen-title-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .kitchen-badge {
      font-size: 0.75rem;
      color: #059669;
      font-weight: 800;
    }

    .kitchen-recipe-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kitchen-progress-track {
      height: 8px;
      background: #e2e8f0;
      border-radius: 9999px;
      margin: 14px 0;
      overflow: hidden;
    }

    .kitchen-progress-bar {
      height: 100%;
      background: #10b981;
      border-radius: 9999px;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .kitchen-step-box {
      flex: 1;
      background: #ffffff;
      border-radius: 20px;
      padding: 20px 22px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .kitchen-step-counter {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 700;
      margin-bottom: 8px;
    }

    .kitchen-step-scroll {
      flex: 1;
      overflow-y: auto;
      padding-right: 4px;
    }

    .kitchen-giant-num {
      font-size: 2.2rem;
      font-weight: 900;
      color: #059669;
      line-height: 1.1;
      margin-bottom: 6px;
    }

    .kitchen-giant-text {
      font-size: 1.45rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.55;
      margin-bottom: 16px;
    }

    .kitchen-tip-box {
      margin: 16px 0;
      background: #fffbeb;
      border-right: 4px solid #f59e0b;
      border-radius: 12px;
      padding: 12px 14px;
      color: #b45309;
      font-size: 0.95rem;
      line-height: 1.4;
      font-weight: 600;
    }

    .kitchen-timer-card {
      margin-top: 16px;
      background: #0f172a;
      border-radius: 16px;
      padding: 16px;
      color: #ffffff;
    }

    .kitchen-timer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .kitchen-timer-badge {
      color: #10b981;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .kitchen-timer-digits {
      font-size: 1.5rem;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }

    .kitchen-timer-buttons {
      display: flex;
      gap: 10px;
    }

    .kitchen-timer-btn {
      border: none;
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }

    .kitchen-timer-btn.primary {
      flex: 1;
      background: #10b981;
      color: #ffffff;
    }

    .kitchen-timer-btn.reset {
      background: #334155;
      color: #94a3b8;
    }

    .kitchen-peek-btn {
      width: 100%;
      margin-top: 16px;
      padding: 10px 14px;
      background: #f1f5f9;
      border: 1px solid var(--border);
      border-radius: 12px;
      color: #059669;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }

    .kitchen-peek-btn:hover {
      background: #e2e8f0;
    }

    .kitchen-peek-box {
      margin-top: 10px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
    }

    .kitchen-peek-title {
      font-weight: 800;
      color: #0f172a;
      font-size: 0.9rem;
      margin-bottom: 8px;
    }

    .kitchen-footer {
      display: flex;
      gap: 12px;
      padding-top: 14px;
    }

    .kitchen-nav-btn {
      border: none;
      border-radius: 14px;
      padding: 14px 20px;
      font-size: 1.05rem;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .kitchen-nav-btn.secondary {
      background: #e2e8f0;
      color: #475569;
    }

    .kitchen-nav-btn.secondary:hover {
      background: #cbd5e1;
    }

    .kitchen-nav-btn.primary {
      flex: 1;
      background: #059669;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }

    .kitchen-nav-btn.primary:hover {
      background: #047857;
    }

    /* App Toast Notification System */
    #toast-container {
      position: fixed;
      top: max(20px, calc(10px + env(safe-area-inset-top, 0px)));
      left: 50%;
      transform: translateX(-50%);
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 90%;
      max-width: 440px;
      pointer-events: none;
      direction: rtl;
    }

    .app-toast {
      pointer-events: auto;
      background: #064e3b;
      color: #ffffff;
      border: 1.5px solid #10b981;
      border-radius: 18px;
      padding: 12px 16px;
      box-shadow: 0 12px 32px rgba(6, 78, 59, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: inherit;
      animation: toastIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      transition: all 0.25s ease;
      backdrop-filter: blur(12px);
    }

    .app-toast.toast-hiding {
      opacity: 0;
      transform: translateY(-16px) scale(0.92);
    }

    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(-24px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .app-toast-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      flex-shrink: 0;
    }

    .app-toast-text {
      flex: 1;
      font-size: 0.92rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .app-toast-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.75);
      font-size: 1.1rem;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.15s;
    }

    .app-toast-close:hover {
      color: #ffffff;
    }

    .app-toast.info {
      background: #0f172a;
      border-color: #38bdf8;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.4);
    }

    .app-toast.warning {
      background: #78350f;
      border-color: #fbbf24;
      box-shadow: 0 12px 32px rgba(120, 53, 15, 0.35);
    }

    .app-toast.timer {
      background: #312e81;
      border-color: #818cf8;
      box-shadow: 0 12px 32px rgba(49, 46, 129, 0.4);
    }

    /* App Confirmation & Celebration Modals */
    .app-dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(6px);
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      direction: rtl;
      text-align: right;
      overflow-y: auto;
      animation: fadeInModal 0.2s ease-out;
    }

    .app-dialog-card {
      background: #ffffff;
      border-radius: 24px;
      padding: 28px 24px 22px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      animation: cardPopIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes cardPopIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .app-dialog-icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      margin-bottom: 14px;
    }

    .app-dialog-title {
      font-size: 1.3rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .app-dialog-desc {
      font-size: 0.95rem;
      color: #64748b;
      line-height: 1.55;
      margin-bottom: 22px;
    }

    .app-dialog-actions {
      display: flex;
      gap: 12px;
      width: 100%;
    }

    .app-dialog-btn {
      flex: 1;
      padding: 13px 18px;
      border-radius: 14px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      border: none;
      transition: all 0.15s ease;
    }

    .app-dialog-btn.cancel {
      background: #f1f5f9;
      color: #475569;
    }

    .app-dialog-btn.cancel:hover {
      background: #e2e8f0;
    }

    .app-dialog-btn.confirm-danger {
      background: #dc2626;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    }

    .app-dialog-btn.confirm-danger:hover {
      background: #b91c1c;
    }

    .app-dialog-btn.confirm-primary {
      background: #059669;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    }

    .app-dialog-btn.confirm-primary:hover {
      background: #047857;
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

  <!-- KITCHEN MODE FULLSCREEN OVERLAY -->
  <div id="kitchen-modal" class="kitchen-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="kitchen-recipe-title">
    <div class="kitchen-modal-inner">
      <!-- Header -->
      <div class="kitchen-header">
        <button type="button" class="kitchen-close-btn" onclick="closeKitchenMode()" aria-label="סגור מצב מטבח">✕ סגור</button>
        <div class="kitchen-title-wrap">
          <span class="kitchen-badge">🍳 Kitchen Mode • מצב מטבח</span>
          <div id="kitchen-recipe-title" class="kitchen-recipe-title"></div>
        </div>
      </div>

      <!-- Mint Progress Track -->
      <div class="kitchen-progress-track">
        <div id="kitchen-progress-bar" class="kitchen-progress-bar" style="width: 0%;"></div>
      </div>

      <!-- Step Content Box -->
      <div class="kitchen-step-box">
        <div class="kitchen-step-counter" id="kitchen-step-counter">שלב 1 מתוך 1</div>

        <div class="kitchen-step-scroll">
          <div class="kitchen-giant-num" id="kitchen-giant-num">1.</div>
          <div class="kitchen-giant-text" id="kitchen-giant-text"></div>

          <!-- Chef Tip Box -->
          <div id="kitchen-tip-box" class="kitchen-tip-box" style="display: none;">
            <div id="kitchen-tip-text"></div>
          </div>

          <!-- Step Timer Card -->
          <div id="kitchen-timer-card" class="kitchen-timer-card" style="display: none;">
            <div class="kitchen-timer-header">
              <span class="kitchen-timer-badge" id="kitchen-timer-badge">⏱️ טיימר לשלב זה</span>
              <span class="kitchen-timer-digits" id="kitchen-timer-digits">00:00</span>
            </div>
            <div class="kitchen-timer-buttons">
              <button type="button" class="kitchen-timer-btn primary" id="kitchen-timer-toggle-btn" onclick="toggleKitchenTimer()">▶ התחל טיימר</button>
              <button type="button" class="kitchen-timer-btn reset" onclick="resetKitchenTimer()">איפוס</button>
            </div>
          </div>

          <!-- Quick Peek Ingredients Toggle -->
          <button type="button" class="kitchen-peek-btn" onclick="toggleKitchenIngredientsPeek()">
            <span id="kitchen-peek-btn-text">🥗 הצג רשימת מצרכים</span>
          </button>
          <div id="kitchen-peek-box" class="kitchen-peek-box" style="display: none;">
            <div class="kitchen-peek-title">מצרכים נדרשים למתכון:</div>
            <div id="kitchen-peek-list"></div>
          </div>
        </div>
      </div>

      <!-- Footer Navigation Buttons -->
      <div class="kitchen-footer">
        <button type="button" class="kitchen-nav-btn secondary" id="kitchen-prev-btn" onclick="prevKitchenStep()">הקודם →</button>
        <button type="button" class="kitchen-nav-btn primary" id="kitchen-next-btn" onclick="nextKitchenStep()">← הבא</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" aria-live="polite"></div>

  <!-- Custom Confirmation Dialog Modal -->
  <div id="confirm-dialog-modal" class="app-dialog-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
    <div class="app-dialog-card">
      <div id="confirm-dialog-badge" class="app-dialog-icon-badge">🗑️</div>
      <h3 id="confirm-dialog-title" class="app-dialog-title">אישור פעולה</h3>
      <p id="confirm-dialog-desc" class="app-dialog-desc">האם את בטוחה שברצונך להמשיך?</p>
      <div class="app-dialog-actions">
        <button type="button" id="confirm-dialog-cancel" class="app-dialog-btn cancel" onclick="closeAppConfirm(false)">ביטול</button>
        <button type="button" id="confirm-dialog-ok" class="app-dialog-btn confirm-danger" onclick="closeAppConfirm(true)">אישור</button>
      </div>
    </div>
  </div>

  <!-- Celebration Modal (Recipe Completed) -->
  <div id="celebration-modal" class="app-dialog-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
    <div class="app-dialog-card">
      <div class="app-dialog-icon-badge" style="background: #ecfdf5; font-size: 2.6rem;">🎉</div>
      <h3 id="celebration-title" class="app-dialog-title" style="color: #064e3b;">כל הכבוד! סיימת לבשל!</h3>
      <p id="celebration-recipe-name" style="font-size: 1.15rem; font-weight: 800; color: #059669; margin-bottom: 8px;"></p>
      <p class="app-dialog-desc" style="margin-bottom: 24px;">המתכון בושל בהצלחה ומוכן להגשה. שיהיה המון בתיאבון! 🍽️</p>
      <button type="button" class="app-dialog-btn confirm-primary" style="width: 100%; font-size: 1.05rem; padding: 14px;" onclick="closeKitchenCompletionModal()">😋 בתיאבון! סיום</button>
    </div>
  </div>

  <script>
    let currentRecipe = null;
    let servingMultiplier = 1;
    let savedRecipes = [];

    // LocalStorage Key
    const STORAGE_KEY = 'my_recipes_app_library';

    // --- App Toast Notification System ---
    function showToast(text, type, icon) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'app-toast ' + (type || 'success');

      var iconChar = icon;
      if (!iconChar) {
        if (type === 'warning') iconChar = '⚠️';
        else if (type === 'info') iconChar = 'ℹ️';
        else if (type === 'timer') iconChar = '⏱️';
        else iconChar = '✓';
      }

      toast.innerHTML =
        '<div class="app-toast-icon-wrap">' + escapeHtml(iconChar) + '</div>' +
        '<div class="app-toast-text">' + escapeHtml(text) + '</div>' +
        '<button type="button" class="app-toast-close" title="סגור" aria-label="סגור">✕</button>';

      var closeBtn = toast.querySelector('.app-toast-close');
      var dismissed = false;
      var dismiss = function() {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add('toast-hiding');
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
      };

      closeBtn.onclick = dismiss;
      container.appendChild(toast);
      setTimeout(dismiss, 3600);
    }

    // --- App Confirmation Dialog ---
    var appConfirmCallback = null;
    function showAppConfirm(options) {
      var modal = document.getElementById('confirm-dialog-modal');
      var titleEl = document.getElementById('confirm-dialog-title');
      var descEl = document.getElementById('confirm-dialog-desc');
      var badgeEl = document.getElementById('confirm-dialog-badge');
      var confirmBtn = document.getElementById('confirm-dialog-ok');
      var cancelBtn = document.getElementById('confirm-dialog-cancel');

      titleEl.textContent = options.title || 'אישור פעולה';
      descEl.textContent = options.text || 'האם את בטוחה שברצונך להמשיך?';
      badgeEl.textContent = options.icon || (options.isDanger ? '🗑️' : '❓');
      badgeEl.style.background = options.isDanger ? '#fee2e2' : '#ecfdf5';

      confirmBtn.textContent = options.confirmLabel || (options.isDanger ? 'מחק' : 'אישור');
      confirmBtn.className = 'app-dialog-btn ' + (options.isDanger ? 'confirm-danger' : 'confirm-primary');
      cancelBtn.textContent = options.cancelLabel || 'ביטול';

      appConfirmCallback = options.onConfirm || null;
      modal.style.display = 'flex';
      if (cancelBtn) cancelBtn.focus();
    }

    function closeAppConfirm(confirmed) {
      var modal = document.getElementById('confirm-dialog-modal');
      modal.style.display = 'none';
      if (confirmed && typeof appConfirmCallback === 'function') {
        var cb = appConfirmCallback;
        appConfirmCallback = null;
        cb();
      } else {
        appConfirmCallback = null;
      }
    }

    // --- Kitchen Completion Celebration Modal ---
    function showKitchenCompletionModal(recipeTitle) {
      var modal = document.getElementById('celebration-modal');
      var nameEl = document.getElementById('celebration-recipe-name');
      if (nameEl) nameEl.textContent = recipeTitle || '';
      modal.style.display = 'flex';
      playKitchenTimerBeep();
    }

    function closeKitchenCompletionModal() {
      var modal = document.getElementById('celebration-modal');
      modal.style.display = 'none';
      closeKitchenMode();
    }

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

        if (recipe) {
          while (recipe && recipe.recipe && typeof recipe.recipe === 'object') {
            recipe = recipe.recipe;
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
      if (!currentRecipe || !currentRecipe.title || currentRecipe.title === 'undefined' || currentRecipe.title === 'null') {
        document.getElementById('recipe-card-content').innerHTML =
          '<div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">' +
            '<div style="font-size: 3.5rem; margin-bottom: 12px;">🍲</div>' +
            '<h3 style="color: var(--primary); margin-bottom: 8px;">עדיין לא נבחר מתכון</h3>' +
            '<p>הדביקי קישור בלשונית &quot;חילוץ מתכון&quot; כדי לצפות במתכון המלא כאן.</p>' +
          '</div>';
        return;
      }
      const baseServings = currentRecipe.servings || 4;
      const servings = Math.round(baseServings * servingMultiplier);

      let html = \`
        \${getRecipeImageHtml(currentRecipe)}

        <div class="recipe-header" style="margin-top: 14px;">
          <h1 class="title" style="margin-top: 0; font-size: 1.65rem;">\${escapeHtml(currentRecipe.title)}</h1>
          <p class="subtitle" style="margin-bottom: 12px; font-size: 0.95rem; line-height: 1.5;">\${escapeHtml(currentRecipe.description || '')}</p>
        </div>

        <!-- Kitchen Mode Entry Button -->
        <button type="button" class="kitchen-mode-btn" onclick="openKitchenMode()" title="מעבר למצב בישול במסך מלא עם גופן ענק">
          <div class="kitchen-mode-btn-content">
            <span class="kitchen-mode-btn-title">🍳 התחל לבשל (מצב מטבח)</span>
            <span class="kitchen-mode-btn-sub">תצוגת מסך מלא עם גופן ענק וצעדים מוגדלים</span>
          </div>
          <span class="kitchen-mode-btn-arrow">←</span>
        </button>

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
                  <strong>\${escapeHtml(amountText)}</strong> \${escapeHtml(ing.name)}
                  \${ing.notes ? \`<span style="color: var(--text-muted); font-size: 0.8rem;">(\${escapeHtml(ing.notes)})</span>\` : ''}
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
              <p style="font-size: 0.95rem; line-height: 1.6;">\${escapeHtml(step.instruction)}</p>
              \${step.tip ? \`<div style="margin-top: 8px; font-size: 0.85rem; color: #b45309; background: #fef3c7; padding: 6px 10px; border-radius: 8px;">💡 טיפ: \${escapeHtml(step.tip)}</div>\` : ''}
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
        unlockKitchenAudio();
        btn.classList.add('active');
        let seconds = minutes * 60;
        btn._timer = setInterval(() => {
          seconds--;
          if (seconds <= 0) {
            clearInterval(btn._timer);
            btn.classList.remove('active');
            btn.textContent = '🔔 הזמן הסתיים!';
            playKitchenTimerBeep();
            showToast('🔔 הזמן הסתיים עבור שלב זה!', 'timer', '⏱️');
          } else {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            btn.textContent = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s;
          }
        }, 1000);
      }
    }

    function renderShopping() {
      let shopping = [];
      try {
        shopping = JSON.parse(localStorage.getItem('my_recipes_app_shopping') || '[]');
      } catch (e) {
        shopping = [];
      }
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
      showToast('המצרכים מתוך "' + currentRecipe.title + '" נוספו בהצלחה לרשימת הקניות! 🛒', 'success', '🛒');
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
      showAppConfirm({
        title: 'ניקוי רשימת הקניות',
        text: 'האם את בטוחה שברצונך למחוק את כל המוצרים מרשימת הקניות?',
        icon: '🛒',
        confirmLabel: 'כן, מחק הכל',
        cancelLabel: 'ביטול',
        isDanger: true,
        onConfirm: function() {
          localStorage.removeItem('my_recipes_app_shopping');
          renderShopping();
          showToast('רשימת הקניות נוקתה בהצלחה', 'info', '🗑️');
        }
      });
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
        showToast('המצרכים הועתקו ללוח בהצלחה! 📋', 'success', '📋');
      });
    }

    function saveCurrentRecipe() {
      if (!currentRecipe) return;
      saveRecipeToStorage(currentRecipe);
      showToast('המתכון נשמר בהצלחה בספר המתכונים שלך! 💾', 'success', '💾');
    }

    function saveRecipeToStorage(recipe) {
      if (!recipe) return;
      let cleanRecipe = recipe;
      while (cleanRecipe && cleanRecipe.recipe && typeof cleanRecipe.recipe === 'object') {
        cleanRecipe = cleanRecipe.recipe;
      }
      if (!cleanRecipe || !cleanRecipe.title || cleanRecipe.title === 'undefined' || cleanRecipe.title === 'null') return;

      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (e) {
        list = [];
      }
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
      let raw = [];
      try {
        raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (e) {
        raw = [];
      }
      // Sanitize: unpack any previously wrapped { recipe: { ... } } or corrupted undefined entries
      savedRecipes = (Array.isArray(raw) ? raw : []).map(item => {
        if (!item || typeof item !== 'object') return null;
        let unpacked = item;
        while (unpacked && unpacked.recipe && typeof unpacked.recipe === 'object') {
          unpacked = unpacked.recipe;
        }
        return unpacked;
      }).filter(item => item && item.title && item.title !== 'undefined' && item.title !== 'null');
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
        let clean = r;
        while (clean && clean.recipe && typeof clean.recipe === 'object') {
          clean = clean.recipe;
        }
        currentRecipe = clean;
        servingMultiplier = 1;
        renderRecipe();
        switchTab('recipe');
      }
    }

    function deleteSavedRecipe(idx) {
      const r = savedRecipes[idx];
      const title = r ? (r.title || 'מתכון זה') : 'מתכון זה';
      showAppConfirm({
        title: 'מחיקת מתכון',
        text: 'האם את בטוחה שברצונך למחוק את "' + title + '" מספר המתכונים שלך?',
        icon: '🗑️',
        confirmLabel: 'כן, מחק מתכון',
        cancelLabel: 'ביטול',
        isDanger: true,
        onConfirm: function() {
          savedRecipes.splice(idx, 1);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
          updateLibraryUI();
          showToast('המתכון נמחק בהצלחה מהספר שלך', 'info', '🗑️');
        }
      });
    }

    // --- Kitchen Mode (מצב מטבח) Logic ---
    let kitchenStepIndex = 0;
    let kitchenTimerInterval = null;
    let kitchenTimerSecondsLeft = null;
    let kitchenTimerTotalSeconds = null;
    let kitchenTimerIsRunning = false;
    let kitchenWakeLock = null;
    let isKitchenPeekOpen = false;

    async function openKitchenMode() {
      if (!currentRecipe || !currentRecipe.instructions || currentRecipe.instructions.length === 0) {
        showToast('מתכון זה אינו מכיל שלבי הכנה מפורטים', 'warning', '⚠️');
        return;
      }
      kitchenStepIndex = 0;
      isKitchenPeekOpen = false;
      document.getElementById('kitchen-modal').style.display = 'flex';
      document.body.style.overflow = 'hidden';

      if ('wakeLock' in navigator) {
        try {
          kitchenWakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {}
      }

      renderKitchenStep();
    }

    function closeKitchenMode() {
      stopKitchenTimer();
      document.getElementById('kitchen-modal').style.display = 'none';
      document.body.style.overflow = '';
      if (kitchenWakeLock) {
        kitchenWakeLock.release().catch(() => {});
        kitchenWakeLock = null;
      }
    }

    function renderKitchenStep() {
      if (!currentRecipe || !currentRecipe.instructions) return;
      const steps = currentRecipe.instructions;
      const total = steps.length;
      if (kitchenStepIndex < 0) kitchenStepIndex = 0;
      if (kitchenStepIndex >= total) kitchenStepIndex = total - 1;

      const step = steps[kitchenStepIndex];
      const progress = Math.round(((kitchenStepIndex + 1) / total) * 100);

      document.getElementById('kitchen-recipe-title').textContent = currentRecipe.title;
      document.getElementById('kitchen-progress-bar').style.width = progress + '%';
      document.getElementById('kitchen-step-counter').textContent = 'שלב ' + (kitchenStepIndex + 1) + ' מתוך ' + total;
      document.getElementById('kitchen-giant-num').textContent = (kitchenStepIndex + 1) + '.';
      document.getElementById('kitchen-giant-text').textContent = step.instruction || '';

      const tipBox = document.getElementById('kitchen-tip-box');
      const tipText = document.getElementById('kitchen-tip-text');
      if (step.tip) {
        tipText.textContent = '💡 טיפ שף: ' + step.tip;
        tipBox.style.display = 'block';
      } else {
        tipBox.style.display = 'none';
      }

      setupKitchenTimerForStep(step.durationMinutes);
      renderKitchenIngredientsPeek();

      const prevBtn = document.getElementById('kitchen-prev-btn');
      const nextBtn = document.getElementById('kitchen-next-btn');
      prevBtn.disabled = (kitchenStepIndex === 0);
      prevBtn.style.opacity = (kitchenStepIndex === 0) ? '0.4' : '1';

      if (kitchenStepIndex === total - 1) {
        nextBtn.textContent = 'סיום בישול 🎉';
        nextBtn.style.background = '#10b981';
      } else {
        nextBtn.textContent = '← הבא';
        nextBtn.style.background = '#059669';
      }

      const scrollArea = document.querySelector('.kitchen-step-scroll');
      if (scrollArea) scrollArea.scrollTop = 0;
    }

    function prevKitchenStep() {
      if (kitchenStepIndex > 0) {
        kitchenStepIndex--;
        renderKitchenStep();
      }
    }

    function nextKitchenStep() {
      if (!currentRecipe || !currentRecipe.instructions) return;
      if (kitchenStepIndex < currentRecipe.instructions.length - 1) {
        kitchenStepIndex++;
        renderKitchenStep();
      } else {
        showKitchenCompletionModal(currentRecipe.title);
      }
    }

    function setupKitchenTimerForStep(durationMinutes) {
      stopKitchenTimer();
      const timerCard = document.getElementById('kitchen-timer-card');
      if (!durationMinutes || durationMinutes <= 0) {
        timerCard.style.display = 'none';
        return;
      }
      timerCard.style.display = 'block';
      kitchenTimerTotalSeconds = Math.round(durationMinutes * 60);
      kitchenTimerSecondsLeft = kitchenTimerTotalSeconds;
      kitchenTimerIsRunning = false;
      document.getElementById('kitchen-timer-badge').textContent = '⏱️ טיימר לשלב זה (' + durationMinutes + ' דק׳)';
      updateKitchenTimerDisplay();
      updateKitchenTimerButton();
    }

    function updateKitchenTimerDisplay() {
      const digits = document.getElementById('kitchen-timer-digits');
      if (kitchenTimerSecondsLeft === null) return;
      const m = Math.floor(kitchenTimerSecondsLeft / 60);
      const s = kitchenTimerSecondsLeft % 60;
      digits.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      if (kitchenTimerSecondsLeft === 0) {
        digits.textContent = '🎉 הזמן הושלם!';
        digits.style.color = '#f59e0b';
      } else {
        digits.style.color = '#ffffff';
      }
    }

    function updateKitchenTimerButton() {
      const btn = document.getElementById('kitchen-timer-toggle-btn');
      if (!btn) return;
      if (kitchenTimerIsRunning) {
        btn.textContent = '⏸ השהה טיימר';
        btn.style.background = '#f59e0b';
      } else {
        btn.textContent = '▶ התחל טיימר';
        btn.style.background = '#10b981';
      }
    }

    function toggleKitchenTimer() {
      if (kitchenTimerIsRunning) {
        pauseKitchenTimer();
      } else {
        startKitchenTimer();
      }
    }

    let sharedKitchenAudioCtx = null;
    function unlockKitchenAudio() {
      try {
        if (!sharedKitchenAudioCtx) {
          sharedKitchenAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (sharedKitchenAudioCtx && sharedKitchenAudioCtx.state === 'suspended') {
          sharedKitchenAudioCtx.resume();
        }
      } catch (e) {}
    }

    function playKitchenTimerBeep() {
      try {
        unlockKitchenAudio();
        if (!sharedKitchenAudioCtx) return;
        const osc = sharedKitchenAudioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, sharedKitchenAudioCtx.currentTime);
        osc.connect(sharedKitchenAudioCtx.destination);
        osc.start();
        osc.stop(sharedKitchenAudioCtx.currentTime + 0.6);
      } catch (e) {}
    }

    function startKitchenTimer() {
      unlockKitchenAudio();
      if (kitchenTimerSecondsLeft === null || kitchenTimerSecondsLeft <= 0) {
        kitchenTimerSecondsLeft = kitchenTimerTotalSeconds;
      }
      kitchenTimerIsRunning = true;
      updateKitchenTimerButton();
      clearInterval(kitchenTimerInterval);
      kitchenTimerInterval = setInterval(() => {
        if (kitchenTimerSecondsLeft > 0) {
          kitchenTimerSecondsLeft--;
          updateKitchenTimerDisplay();
        } else {
          stopKitchenTimer();
          updateKitchenTimerDisplay();
          playKitchenTimerBeep();
        }
      }, 1000);
    }

    function pauseKitchenTimer() {
      kitchenTimerIsRunning = false;
      clearInterval(kitchenTimerInterval);
      updateKitchenTimerButton();
    }

    function stopKitchenTimer() {
      kitchenTimerIsRunning = false;
      clearInterval(kitchenTimerInterval);
      updateKitchenTimerButton();
    }

    function resetKitchenTimer() {
      stopKitchenTimer();
      kitchenTimerSecondsLeft = kitchenTimerTotalSeconds;
      updateKitchenTimerDisplay();
    }

    function toggleKitchenIngredientsPeek() {
      isKitchenPeekOpen = !isKitchenPeekOpen;
      const box = document.getElementById('kitchen-peek-box');
      const btnText = document.getElementById('kitchen-peek-btn-text');
      if (isKitchenPeekOpen) {
        box.style.display = 'block';
        btnText.textContent = '▲ הסתר מצרכים לשלב זה';
      } else {
        box.style.display = 'none';
        btnText.textContent = '🥗 הצג רשימת מצרכים';
      }
    }

    function renderKitchenIngredientsPeek() {
      const box = document.getElementById('kitchen-peek-box');
      const btnText = document.getElementById('kitchen-peek-btn-text');
      const list = document.getElementById('kitchen-peek-list');
      box.style.display = isKitchenPeekOpen ? 'block' : 'none';
      btnText.textContent = isKitchenPeekOpen ? '▲ הסתר מצרכים לשלב זה' : '🥗 הצג רשימת מצרכים';

      if (!currentRecipe || !currentRecipe.ingredients) {
        list.innerHTML = '';
        return;
      }

      list.innerHTML = currentRecipe.ingredients.map(ing => {
        const rawAmount = ing.amount !== null && ing.amount !== undefined ? (ing.amount * servingMultiplier) : null;
        const scaled = rawAmount !== null ? (rawAmount % 1 === 0 ? rawAmount : rawAmount.toFixed(1)) : null;
        const amountText = scaled ? (scaled + ' ' + (ing.unit || '')) : '';
        return '<div style="font-size: 0.95rem; color: #334155; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">• <strong>' + escapeHtml(amountText) + '</strong> ' + escapeHtml(ing.name) + '</div>';
      }).join('');
    }

    window.addEventListener('keydown', (e) => {
      const confirmModal = document.getElementById('confirm-dialog-modal');
      if (confirmModal && confirmModal.style.display !== 'none') {
        if (e.key === 'Escape') closeAppConfirm(false);
        return;
      }
      const celebModal = document.getElementById('celebration-modal');
      if (celebModal && celebModal.style.display !== 'none') {
        if (e.key === 'Escape' || e.key === 'Enter') closeKitchenCompletionModal();
        return;
      }
      const modal = document.getElementById('kitchen-modal');
      if (!modal || modal.style.display === 'none') return;
      if (e.key === 'Escape') {
        closeKitchenMode();
      } else if (e.key === 'ArrowLeft') {
        nextKitchenStep();
      } else if (e.key === 'ArrowRight') {
        prevKitchenStep();
      }
    });

    document.addEventListener('visibilitychange', async () => {
      const modal = document.getElementById('kitchen-modal');
      if (modal && modal.style.display !== 'none' && document.visibilityState === 'visible' && ('wakeLock' in navigator)) {
        try {
          kitchenWakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {}
      }
    });

    window.onload = init;
  </script>
</body>
</html>`;
}
