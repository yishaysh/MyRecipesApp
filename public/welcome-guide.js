// Welcome Guide v2.2.0 (Build 48) — Calm, Organic, Non-Blocking First-Run Experience
// Lazy-loaded ONLY when needed (zero cost for returning users).

export const WELCOME_GUIDE_KEY = 'recipes_welcome_guide_v1';
export const LEGACY_QUEST_KEYS = ['recipes_quest_v2', 'my_recipes_onboarding_v210'];

export const WELCOME_DEMO_RECIPE = {
  id: 'rec_welcome_demo_local',
  title: 'שקשוקה ביתית מהירה',
  description: 'מתכון הדגמה מקומי — לא נשמר בספר עד שלוחצים "שמור לספר".',
  platform: 'web',
  sourceUrl: '',
  servings: 4,
  prepTimeMinutes: 5,
  cookTimeMinutes: 15,
  totalTimeMinutes: 20,
  difficulty: 'קל',
  imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&auto=format&fit=crop',
  ingredients: [
    { id: 'wd1', name: 'עגבניות בשלות', amount: 5, unit: 'יחידות', category: 'produce', originalText: '5 עגבניות בשלות' },
    { id: 'wd2', name: 'ביצים גדולות', amount: 4, unit: 'יחידות', category: 'dairy', originalText: '4 ביצים גדולות' },
    { id: 'wd3', name: 'שום כתוש', amount: 3, unit: 'שיניים', category: 'produce', originalText: '3 שיני שום' }
  ],
  instructions: [
    { stepNumber: 1, instruction: 'מחממים שמן זית במחבת ומטגנים שום כדקה.', durationMinutes: 2 },
    { stepNumber: 2, instruction: 'מוסיפים עגבניות ומבשלים 10 דקות עד שהרוטב מסמיך.', durationMinutes: 10 },
    { stepNumber: 3, instruction: 'שוברים ביצים מעל, מכסים ומבשלים 4 דקות.', durationMinutes: 4 }
  ],
  tags: ['מהיר', 'ארוחת ערב']
};

export const GUIDE_STEPS = [
  {
    id: 'what_it_does',
    title: 'קישור אחד, מתכון נקי',
    sentence: 'מדביקים קישור מטיקטוק, אינסטגרם או יוטיוב — או טקסט — ומקבלים מתכון מסודר בעברית.'
  },
  {
    id: 'live_preview',
    title: 'הצצה חיה למתכון',
    sentence: 'כך נראה מתכון מוכן עם מצרכים, כמויות ושלבי הכנה ברורים.'
  },
  {
    id: 'kitchen_and_shopping',
    title: 'מבשלים וקונים בקלות',
    sentence: 'מצב מטבח נוח עם טיימרים ורשימת קניות מסודרת לפי מחלקות.'
  },
  {
    id: 'ready',
    title: 'הכל מוכן למתכון הראשון',
    sentence: 'אפשר להדביק קישור ראשון ולהתחיל לבשל בקצב שלך.'
  }
];

/**
 * One-time migration for existing users:
 * If legacy guide keys exist or the user already has saved recipes, mark the new guide done
 * and clean up legacy keys so existing users are never interrupted.
 */
export function migrateLegacyGuideState(hasExistingRecipes = false) {
  try {
    const already = localStorage.getItem(WELCOME_GUIDE_KEY);
    let hadLegacy = false;
    for (const k of LEGACY_QUEST_KEYS) {
      if (localStorage.getItem(k) !== null) {
        hadLegacy = true;
        localStorage.removeItem(k);
      }
    }
    if (!already && (hadLegacy || hasExistingRecipes)) {
      localStorage.setItem(WELCOME_GUIDE_KEY, 'done');
      return 'done';
    }
    return already || 'new';
  } catch (_e) {
    return 'done';
  }
}

class WelcomeGuideController {
  constructor(hooks = {}) {
    this.hooks = hooks || {};
    this.root = null;
    this.active = false;
    this.stepIndex = 0;
    this.soundEnabled = false;
    this.audioCtx = null;
    this.demoSaved = false;
    this.cleanupFns = [];
    this.timers = [];
    this.previouslyFocusedEl = null;
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  playSoftTick() {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 540;
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (_e) {}
  }

  markDone() {
    try {
      localStorage.setItem(WELCOME_GUIDE_KEY, 'done');
      for (const k of LEGACY_QUEST_KEYS) localStorage.removeItem(k);
    } catch (_e) {}
    try {
      if (typeof this.hooks.syncCompleted === 'function') {
        this.hooks.syncCompleted();
      }
    } catch (_e) {}
  }

  injectStyles() {
    if (document.getElementById('welcome-guide-styles')) return;
    const style = document.createElement('style');
    style.id = 'welcome-guide-styles';
    style.textContent = `
      .wg-root {
        position: fixed;
        inset: 0;
        z-index: 10010;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: max(16px, env(safe-area-inset-top)) 14px max(88px, env(safe-area-inset-bottom));
        direction: rtl;
        font-family: inherit;
      }
      .wg-card {
        position: relative;
        pointer-events: auto;
        width: min(392px, calc(100vw - 24px));
        max-height: calc(100vh - 110px);
        overflow-y: auto;
        background: #0f1f1c;
        color: #f8fafc;
        border-radius: 38px 34px 40px 36px;
        padding: 20px 20px 22px;
        box-shadow: 0 24px 56px rgba(2, 12, 10, 0.42), 0 0 0 1px rgba(110, 231, 183, 0.22);
        text-align: center;
        box-sizing: border-box;
        isolation: isolate;
      }
      .wg-blob-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        opacity: 0.9;
      }
      .wg-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 12px;
      }
      .wg-skip-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
        border: none;
        border-radius: 999px;
        padding: 8px 16px;
        min-height: 40px;
        font-family: inherit;
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
      }
      .wg-skip-btn:hover, .wg-skip-btn:focus-visible {
        background: rgba(255, 255, 255, 0.18);
        outline: 2px solid #6ee7b7;
        outline-offset: 2px;
      }
      .wg-sound-btn {
        background: rgba(255, 255, 255, 0.09);
        color: #e2e8f0;
        border: none;
        border-radius: 999px;
        min-width: 40px;
        min-height: 40px;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .wg-sound-btn:focus-visible {
        outline: 2px solid #6ee7b7;
        outline-offset: 2px;
      }
      .wg-dots {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .wg-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.25);
        transition: width 220ms ease, background 220ms ease;
      }
      .wg-dot.active {
        width: 22px;
        background: #34d399;
      }
      .wg-stage {
        transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1), transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .wg-stage.entering {
        opacity: 0;
        transform: scale(0.97);
      }
      @media (prefers-reduced-motion: reduce) {
        .wg-stage, .wg-dot, .wg-hint-ring {
          transition: none !important;
          animation: none !important;
        }
      }
      .wg-title {
        font-size: 1.24rem;
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 8px;
        line-height: 1.3;
      }
      .wg-sentence {
        font-size: 0.94rem;
        line-height: 1.55;
        color: #d1fae5;
        margin: 0 0 18px;
      }
      /* Step 1: Organic flow medallions */
      .wg-medallions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin: 8px 0 18px;
        flex-wrap: wrap;
      }
      .wg-pill-source {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        font-size: 0.84rem;
        font-weight: 700;
      }
      .wg-circle-dish {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #34d399, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        box-shadow: 0 10px 26px rgba(16, 185, 129, 0.35);
      }
      /* Step 2: Organic live recipe preview */
      .wg-demo-blob {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 30px 34px 30px 34px;
        padding: 14px 16px;
        margin: 0 0 16px;
        text-align: right;
      }
      .wg-demo-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .wg-demo-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        background: #065f46;
      }
      .wg-demo-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }
      .wg-demo-pill {
        background: rgba(52, 211, 153, 0.16);
        color: #ecfdf5;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .wg-save-demo-btn {
        background: rgba(255, 255, 255, 0.14);
        color: #ecfdf5;
        border: none;
        border-radius: 999px;
        padding: 8px 16px;
        min-height: 40px;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 800;
        cursor: pointer;
      }
      .wg-save-demo-btn:disabled {
        background: rgba(16, 185, 129, 0.28);
        color: #a7f3d0;
        cursor: default;
      }
      /* Step 3: Two circular previews */
      .wg-two-circles {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 20px;
        margin: 6px 0 18px;
      }
      .wg-circle-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        max-width: 132px;
      }
      .wg-circle-preview {
        width: 112px;
        height: 112px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 10px;
        box-sizing: border-box;
      }
      .wg-circle-kitchen {
        background: radial-gradient(circle at 30% 25%, #10b981, #065f46);
      }
      .wg-circle-shop {
        background: radial-gradient(circle at 30% 25%, #f59e0b, #b45309);
      }
      .wg-circle-caption {
        font-size: 0.85rem;
        font-weight: 800;
        color: #f8fafc;
      }
      /* Step 4: Calm finish emblem */
      .wg-finish-orb {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        margin: 6px auto 16px;
        background: radial-gradient(circle at 32% 28%, #34d399, #047857);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.4rem;
        box-shadow: 0 12px 28px rgba(16, 185, 129, 0.34);
      }
      .wg-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .wg-btn-primary {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        border: none;
        border-radius: 999px;
        padding: 12px 30px;
        min-height: 46px;
        font-family: inherit;
        font-size: 0.98rem;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(16, 185, 129, 0.34);
      }
      .wg-btn-primary:hover, .wg-btn-primary:focus-visible {
        filter: brightness(1.06);
        outline: 2px solid #a7f3d0;
        outline-offset: 2px;
      }
      /* Non-blocking circular spotlight hint on Finish (pointer-events: none ALWAYS) */
      .wg-hint-layer {
        position: fixed;
        inset: 0;
        z-index: 10010;
        pointer-events: none;
        direction: rtl;
      }
      .wg-hint-ring {
        position: fixed;
        top: 0;
        left: 0;
        border-radius: 50%;
        border: 3px solid #10b981;
        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.18);
        pointer-events: none;
        box-sizing: border-box;
        transition: opacity 240ms ease;
      }
      .wg-hint-pill {
        position: fixed;
        top: 0;
        left: 0;
        background: #0f1f1c;
        color: #ecfdf5;
        border-radius: 999px;
        padding: 9px 16px;
        font-size: 0.85rem;
        font-weight: 800;
        box-shadow: 0 12px 28px rgba(2, 12, 10, 0.35), 0 0 0 1px rgba(52, 211, 153, 0.35);
        pointer-events: none;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  clearRuntime() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
    this.cleanupFns.forEach((fn) => { try { fn(); } catch (_e) {} });
    this.cleanupFns = [];
  }

  destroyDom() {
    this.clearRuntime();
    if (this.root) { this.root.remove(); this.root = null; }
    this.active = false;
    if (this.previouslyFocusedEl && typeof this.previouslyFocusedEl.focus === 'function') {
      try { this.previouslyFocusedEl.focus(); } catch (_e) {}
    }
    this.previouslyFocusedEl = null;
  }

  renderVisual(stepId) {
    if (stepId === 'what_it_does') {
      return `
        <div class="wg-medallions" aria-hidden="true">
          <span class="wg-pill-source">🎵 TikTok</span>
          <span class="wg-pill-source">📸 Instagram</span>
          <span class="wg-pill-source">▶️ YouTube</span>
          <div class="wg-circle-dish">🍲</div>
        </div>
      `;
    }
    if (stepId === 'live_preview') {
      const r = WELCOME_DEMO_RECIPE;
      return `
        <div class="wg-demo-blob">
          <div class="wg-demo-head">
            <img class="wg-demo-avatar" src="${r.imageUrl}" alt="${r.title}" referrerpolicy="no-referrer">
            <div style="min-width:0;">
              <div style="font-weight:900; font-size:0.98rem; color:#ffffff;">${r.title}</div>
              <div style="font-size:0.78rem; color:#a7f3d0;">⏱️ ${r.totalTimeMinutes} דק׳ • 🍽️ ${r.servings} מנות</div>
            </div>
          </div>
          <div class="wg-demo-pills">
            ${r.ingredients.map((i) => `<span class="wg-demo-pill">${i.amount} ${i.unit} ${i.name}</span>`).join('')}
          </div>
          <div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:10px;">1. ${r.instructions[0].instruction}</div>
          <button type="button" class="wg-save-demo-btn" id="wg-save-demo-btn" ${this.demoSaved ? 'disabled' : ''}>
            ${this.demoSaved ? '✓ נשמר בספר שלך' : '＋ שמור לספר'}
          </button>
        </div>
      `;
    }
    if (stepId === 'kitchen_and_shopping') {
      return `
        <div class="wg-two-circles">
          <div class="wg-circle-item">
            <div class="wg-circle-preview wg-circle-kitchen" aria-hidden="true">
              <span style="font-size:2rem;">👨‍🍳</span>
              <span style="font-size:0.74rem; font-weight:800; color:#ecfdf5;">טקסט גדול + טיימר</span>
            </div>
            <span class="wg-circle-caption">מצב מטבח</span>
          </div>
          <div class="wg-circle-item">
            <div class="wg-circle-preview wg-circle-shop" aria-hidden="true">
              <span style="font-size:2rem;">🛒</span>
              <span style="font-size:0.74rem; font-weight:800; color:#fffbeb;">מסודר לפי מחלקות</span>
            </div>
            <span class="wg-circle-caption">רשימת קניות</span>
          </div>
        </div>
      `;
    }
    return `<div class="wg-finish-orb" aria-hidden="true">✨</div>`;
  }

  renderStep(idx) {
    this.stepIndex = Math.max(0, Math.min(GUIDE_STEPS.length - 1, idx));
    const step = GUIDE_STEPS[this.stepIndex];
    const isLast = this.stepIndex === GUIDE_STEPS.length - 1;

    if (!this.root) {
      this.injectStyles();
      const root = document.createElement('div');
      root.id = 'welcome-guide-root';
      root.className = 'wg-root';
      document.body.appendChild(root);
      this.root = root;
    }

    this.root.innerHTML = `
      <div class="wg-card" role="dialog" aria-modal="false" aria-labelledby="wg-title">
        <svg class="wg-blob-bg" viewBox="0 0 400 360" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="wgBlobGrad1" cx="25%" cy="20%" r="65%">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="wgBlobGrad2" cx="80%" cy="85%" r="60%">
              <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.20"/>
              <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <path d="M-20,90 C40,-20 190,-10 250,60 C310,130 220,240 120,230 C20,220 -60,180 -20,90 Z" fill="url(#wgBlobGrad1)"/>
          <path d="M180,190 C250,140 390,170 420,260 C440,340 310,390 220,350 C140,315 120,235 180,190 Z" fill="url(#wgBlobGrad2)"/>
        </svg>

        <div class="wg-topbar">
          <button type="button" class="wg-skip-btn" id="wg-skip-btn">דלג</button>
          <div class="wg-dots" aria-hidden="true">
            ${GUIDE_STEPS.map((_, i) => `<span class="wg-dot ${i === this.stepIndex ? 'active' : ''}"></span>`).join('')}
          </div>
          <button type="button" class="wg-sound-btn" id="wg-sound-btn" aria-pressed="${this.soundEnabled ? 'true' : 'false'}" aria-label="צליל">${this.soundEnabled ? '🔊' : '🔇'}</button>
        </div>

        <div class="wg-stage ${this.reducedMotion ? '' : 'entering'}" id="wg-stage">
          ${this.renderVisual(step.id)}
          <h2 class="wg-title" id="wg-title">${step.title}</h2>
          <p class="wg-sentence">${step.sentence}</p>
          <div class="wg-actions">
            <button type="button" class="wg-btn-primary" id="wg-next-btn">${isLast ? 'בוא נתחיל' : 'הבא ←'}</button>
          </div>
        </div>
      </div>
    `;

    const stage = this.root.querySelector('#wg-stage');
    if (stage && !this.reducedMotion) {
      requestAnimationFrame(() => stage.classList.remove('entering'));
    }

    const skipBtn = this.root.querySelector('#wg-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = () => {
        this.markDone();
        this.destroyDom();
      };
    }

    const soundBtn = this.root.querySelector('#wg-sound-btn');
    if (soundBtn) {
      soundBtn.onclick = () => {
        this.soundEnabled = !this.soundEnabled;
        soundBtn.setAttribute('aria-pressed', String(this.soundEnabled));
        soundBtn.textContent = this.soundEnabled ? '🔊' : '🔇';
        if (this.soundEnabled) this.playSoftTick();
      };
    }

    const saveDemoBtn = this.root.querySelector('#wg-save-demo-btn');
    if (saveDemoBtn && !this.demoSaved) {
      saveDemoBtn.onclick = () => {
        this.demoSaved = true;
        saveDemoBtn.disabled = true;
        saveDemoBtn.textContent = '✓ נשמר בספר שלך';
        this.playSoftTick();
        try {
          this.hooks.saveDemoRecipe?.({ ...WELCOME_DEMO_RECIPE });
        } catch (_e) {}
      };
    }

    const nextBtn = this.root.querySelector('#wg-next-btn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        this.playSoftTick();
        if (isLast) {
          this.finishAndShowExtractHint();
        } else {
          this.renderStep(this.stepIndex + 1);
        }
      };
      try { nextBtn.focus(); } catch (_e) {}
    }
  }

  finishAndShowExtractHint() {
    this.markDone();
    this.destroyDom();
    try { this.hooks.switchTab?.('library'); } catch (_e) {}

    // Show a single soft, non-blocking circular spotlight hint pointing to the "חלץ" button
    const target = document.getElementById('tab-btn-extract');
    if (!target) return;

    this.injectStyles();
    const hintLayer = document.createElement('div');
    hintLayer.id = 'welcome-extract-hint';
    hintLayer.className = 'wg-hint-layer';
    hintLayer.setAttribute('aria-hidden', 'true');
    hintLayer.innerHTML = `
      <div class="wg-hint-ring" id="wg-hint-ring"></div>
      <div class="wg-hint-pill" id="wg-hint-pill">✨ כאן מדביקים קישור ראשון</div>
    `;
    document.body.appendChild(hintLayer);

    const ring = hintLayer.querySelector('#wg-hint-ring');
    const pill = hintLayer.querySelector('#wg-hint-pill');

    const positionHint = () => {
      const r = target.getBoundingClientRect();
      if (!r || r.width < 4 || r.height < 4) return;
      const dia = Math.max(r.width, r.height) + 14;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      ring.style.width = `${Math.round(dia)}px`;
      ring.style.height = `${Math.round(dia)}px`;
      ring.style.transform = `translate3d(${Math.round(cx - dia / 2)}px, ${Math.round(cy - dia / 2)}px, 0)`;

      const pw = pill.offsetWidth || 190;
      const ph = pill.offsetHeight || 36;
      const vw = window.innerWidth;
      const px = Math.max(12, Math.min(vw - pw - 12, cx - pw / 2));
      const py = Math.max(12, cy - dia / 2 - ph - 12);
      pill.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
    };

    positionHint();
    const dismissHint = () => {
      hintLayer.remove();
      window.removeEventListener('resize', positionHint);
      document.removeEventListener('pointerdown', dismissHint, true);
    };
    window.addEventListener('resize', positionHint, { passive: true });
    document.addEventListener('pointerdown', dismissHint, true);
    setTimeout(dismissHint, 8000);
  }

  start({ force = false } = {}) {
    if (this.active) return;
    if (!force && localStorage.getItem(WELCOME_GUIDE_KEY) === 'done') return;
    this.active = true;
    this.demoSaved = false;
    this.previouslyFocusedEl = typeof document !== 'undefined' ? document.activeElement : null;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        this.markDone();
        this.destroyDom();
      }
    };
    document.addEventListener('keydown', onKey);
    this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));

    this.renderStep(0);
  }
}

let singletonGuide = null;

export function startWelcomeGuide(hooks = {}, options = {}) {
  try {
    if (!singletonGuide) {
      singletonGuide = new WelcomeGuideController(hooks);
    } else {
      singletonGuide.hooks = hooks || singletonGuide.hooks;
    }
    singletonGuide.start(options);
    return singletonGuide;
  } catch (err) {
    console.warn('[WelcomeGuide] Failed safely:', err);
    try { localStorage.setItem(WELCOME_GUIDE_KEY, 'done'); } catch (_e) {}
    return null;
  }
}
