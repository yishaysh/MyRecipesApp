// Welcome Guide v2.3.2 (Build 51) — Live Frameless Translucent Circular-Spotlight In-App Tour
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

export const TOUR_STOPS = [
  {
    id: 'extract_input',
    extractDemoStage: 'input',
    selector: '#extract-input-url-wrap, #url-input, #extract-mode-btn-url',
    caption: 'שלב 1: מדביקים קישור, טקסט או תמונה של מתכון'
  },
  {
    id: 'extract_reading',
    extractDemoStage: 'reading',
    selector: '#progress-box',
    caption: 'שלב 2: האפליקציה קוראת את הסרטון או הטקסט'
  },
  {
    id: 'extract_ready',
    extractDemoStage: 'ready',
    selector: '#progress-box',
    caption: 'שלב 3: נבנה מתכון נקי בעברית עם מצרכים ושלבים'
  },
  {
    id: 'library',
    extractDemoStage: 'restore_to_library',
    selector: '#tab-btn-library',
    caption: 'שלב 4: המתכון נשמר בספר המתכונים ובקבוצות שלך'
  },
  {
    id: 'discover',
    selector: '#tab-btn-discover',
    caption: 'רעיונות ומתכונים פופולריים מחכים בגילוי'
  },
  {
    id: 'shopping',
    selector: '#tab-btn-shopping',
    caption: 'רשימת קניות מסודרת אוטומטית לפי מחלקות'
  },
  {
    id: 'profile',
    selector: '#tab-btn-profile',
    caption: 'גיבוי בענן, מצב כהה והמדריך בכל זמן'
  }
];

/**
 * One-time migration for existing users:
 * Cleans up legacy keys and marks existing users done so they are never interrupted.
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

/**
 * Pure viewport-clamped caption positioning helper.
 * Keeps the frameless floating caption inside the viewport without covering the target spotlight.
 */
export function computeTourCaptionPos(targetCircle, viewport, captionSize) {
  const vw = Math.max(0, Number(viewport?.width) || 390);
  const vh = Math.max(0, Number(viewport?.height) || 844);
  const cw = Math.min(320, Math.max(200, Number(captionSize?.width) || Math.min(310, vw - 32)));
  const ch = Math.max(96, Number(captionSize?.height) || 140);
  const pad = 16;

  if (!targetCircle || !targetCircle.r) {
    return {
      left: Math.round(Math.max(pad, (vw - cw) / 2)),
      top: Math.round(Math.max(24, (vh - ch) / 2)),
      pointerDir: 'none'
    };
  }

  const desiredLeft = targetCircle.cx - cw / 2;
  const left = Math.round(Math.max(pad, Math.min(vw - cw - pad, desiredLeft)));

  // Prefer below if target is in upper half (e.g. Extract input/progress), prefer above for bottom tab bar
  const targetInUpperHalf = targetCircle.cy < vh * 0.52;
  const belowTop = targetCircle.cy + targetCircle.r + 22;
  const aboveTop = targetCircle.cy - targetCircle.r - ch - 22;

  if (targetInUpperHalf && belowTop + ch <= vh - 20) {
    return { left, top: Math.round(belowTop), pointerDir: 'up' };
  }
  if (aboveTop >= 20) {
    return { left, top: Math.round(aboveTop), pointerDir: 'down' };
  }
  const clampedBelow = Math.min(vh - ch - 20, belowTop);
  return { left, top: Math.round(Math.max(20, clampedBelow)), pointerDir: 'up' };
}

class LiveWelcomeTourController {
  constructor(hooks = {}) {
    this.hooks = hooks || {};
    this.root = null;
    this.backdropEl = null;
    this.glowEl = null;
    this.captionEl = null;
    this.active = false;
    this.phase = 'intro'; // 'intro' | 'tour' | 'demo'
    this.stopIndex = 0;
    this.demoSaved = false;
    this.resizeObs = null;
    this.boundTargetEl = null;
    this.boundTargetHandler = null;
    this.cleanupFns = [];
    this.glideRafId = null;
    this.currentCircle = { cx: 195, cy: 420, r: 0 };
    this.previouslyFocusedEl = null;
    this.initialTab = 'library';
    this.savedExtractSnapshot = null;
    this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  markDone() {
    try {
      localStorage.setItem(WELCOME_GUIDE_KEY, 'done');
      for (const k of LEGACY_QUEST_KEYS) localStorage.removeItem(k);
    } catch (_e) {}
    try {
      if (typeof this.hooks.syncCompleted === 'function') this.hooks.syncCompleted();
    } catch (_e) {}
  }

  captureExtractSnapshot() {
    if (this.savedExtractSnapshot) return;
    const urlInput = document.getElementById('url-input');
    const progressBox = document.getElementById('progress-box');
    const titleEl = document.getElementById('progress-title');
    const pctEl = document.getElementById('progress-pct');
    const fillEl = document.getElementById('extract-progress-fill');
    const detailEl = document.getElementById('progress-detail');
    const bgHintEl = document.getElementById('progress-bg-hint');
    this.savedExtractSnapshot = {
      urlValue: urlInput ? urlInput.value : '',
      progressDisplay: progressBox ? progressBox.style.display : '',
      titleText: titleEl ? titleEl.textContent : '',
      pctText: pctEl ? pctEl.textContent : '',
      fillWidth: fillEl ? fillEl.style.width : '',
      detailText: detailEl ? detailEl.textContent : '',
      bgHintDisplay: bgHintEl ? bgHintEl.style.display : ''
    };
  }

  restoreExtractSnapshot(returnToInitialTab = false) {
    if (this.savedExtractSnapshot) {
      const snap = this.savedExtractSnapshot;
      const urlInput = document.getElementById('url-input');
      const progressBox = document.getElementById('progress-box');
      const titleEl = document.getElementById('progress-title');
      const pctEl = document.getElementById('progress-pct');
      const fillEl = document.getElementById('extract-progress-fill');
      const detailEl = document.getElementById('progress-detail');
      const bgHintEl = document.getElementById('progress-bg-hint');
      if (urlInput) urlInput.value = snap.urlValue;
      if (progressBox) progressBox.style.display = snap.progressDisplay;
      if (titleEl) titleEl.textContent = snap.titleText;
      if (pctEl) pctEl.textContent = snap.pctText;
      if (fillEl) fillEl.style.width = snap.fillWidth;
      if (detailEl) detailEl.textContent = snap.detailText;
      if (bgHintEl) bgHintEl.style.display = snap.bgHintDisplay;
      this.savedExtractSnapshot = null;
    }
    if (returnToInitialTab && this.initialTab) {
      try { this.hooks.switchTab?.(this.initialTab); } catch (_e) {}
    }
  }

  applyExtractDemoStage(stage) {
    if (!stage) return;
    if (stage === 'restore_to_library') {
      this.restoreExtractSnapshot(false);
      try { this.hooks.switchTab?.('library'); } catch (_e) {}
      return;
    }

    this.captureExtractSnapshot();
    try { this.hooks.switchTab?.('extract'); } catch (_e) {}
    try {
      if (typeof window.setExtractMode === 'function') window.setExtractMode('url');
    } catch (_e) {}

    const urlInput = document.getElementById('url-input');
    const progressBox = document.getElementById('progress-box');
    const titleEl = document.getElementById('progress-title');
    const pctEl = document.getElementById('progress-pct');
    const fillEl = document.getElementById('extract-progress-fill');
    const detailEl = document.getElementById('progress-detail');
    const bgHintEl = document.getElementById('progress-bg-hint');

    if (stage === 'input') {
      if (urlInput && !urlInput.value) urlInput.value = 'https://www.instagram.com/reel/demo-recipe/';
      if (progressBox) progressBox.style.display = 'none';
    } else if (stage === 'reading') {
      if (progressBox) progressBox.style.display = 'block';
      if (titleEl) titleEl.textContent = '🧠 שלב 2/3: קורא את הסרטון ומזהה מצרכים...';
      if (pctEl) pctEl.textContent = '58%';
      if (fillEl) fillEl.style.width = '58%';
      if (detailEl) detailEl.textContent = 'הדגמה מקומית — לא מנצלת מכסה';
      if (bgHintEl) bgHintEl.style.display = 'none';
    } else if (stage === 'ready') {
      if (progressBox) progressBox.style.display = 'block';
      if (titleEl) titleEl.textContent = '✨ המתכון מוכן: שקשוקה ביתית מהירה';
      if (pctEl) pctEl.textContent = '100%';
      if (fillEl) fillEl.style.width = '100%';
      if (detailEl) detailEl.textContent = '3 מצרכים • 3 שלבי הכנה מסודרים בעברית';
      if (bgHintEl) bgHintEl.style.display = 'none';
    }
  }

  injectStyles() {
    if (document.getElementById('welcome-tour-styles')) return;
    const style = document.createElement('style');
    style.id = 'welcome-tour-styles';
    style.textContent = `
      .wt-root {
        position: fixed;
        inset: 0;
        z-index: 10010;
        pointer-events: none;
        direction: rtl;
        font-family: inherit;
      }
      /* Light translucent frosted backdrop (~18% tint, 3px blur) — app clearly visible underneath, NEVER blocks taps */
      .wt-backdrop {
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: rgba(6, 16, 14, 0.18);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        transition: opacity 260ms ease;
      }
      /* Soft organic feathered glow ring gliding around target — pointer-events: none */
      .wt-glow-ring {
        position: fixed;
        top: 0;
        left: 0;
        border-radius: 50%;
        pointer-events: none;
        box-sizing: border-box;
        border: 2.5px solid rgba(16, 185, 129, 0.9);
        box-shadow: 0 0 22px rgba(16, 185, 129, 0.45), inset 0 0 10px rgba(110, 231, 183, 0.25);
        transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), width 360ms cubic-bezier(0.22, 1, 0.36, 1), height 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease;
      }
      /* Frameless floating caption with soft local feathered scrim ONLY behind the text (NO box, NO border) */
      .wt-caption {
        position: fixed;
        top: 0;
        left: 0;
        width: min(326px, calc(100vw - 24px));
        padding: 18px 20px;
        box-sizing: border-box;
        pointer-events: none;
        text-align: center;
        color: #ffffff;
        background: radial-gradient(ellipse at center, rgba(6, 16, 14, 0.62) 0%, rgba(6, 16, 14, 0.34) 54%, rgba(6, 16, 14, 0) 80%);
        transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease;
      }
      .wt-intro-wrap {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        pointer-events: none;
        background: radial-gradient(circle at center, rgba(6, 16, 14, 0.56) 0%, rgba(6, 16, 14, 0.22) 48%, rgba(6, 16, 14, 0) 76%);
        transition: opacity 240ms ease;
      }
      .wt-welcome-title {
        font-size: clamp(2.1rem, 8.5vw, 2.9rem);
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 10px;
        letter-spacing: -0.01em;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.78), 0 1px 4px rgba(0, 0, 0, 0.95);
      }
      .wt-welcome-sub {
        font-size: 1.04rem;
        font-weight: 700;
        color: #ecfdf5;
        margin: 0 0 24px;
        max-width: 320px;
        line-height: 1.5;
        text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9);
      }
      .wt-caption-text {
        font-size: 1.12rem;
        font-weight: 800;
        line-height: 1.45;
        color: #ffffff;
        margin: 0 0 12px;
        text-shadow: 0 2px 16px rgba(0, 0, 0, 0.95), 0 1px 4px rgba(0, 0, 0, 0.98);
      }
      .wt-controls {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        pointer-events: auto;
      }
      .wt-btn-pill {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        border: none;
        border-radius: 999px;
        padding: 11px 26px;
        min-height: 44px;
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(2, 24, 18, 0.45);
      }
      .wt-btn-pill:hover, .wt-btn-pill:focus-visible {
        filter: brightness(1.07);
        outline: 2px solid #a7f3d0;
        outline-offset: 3px;
      }
      .wt-btn-text {
        background: rgba(6, 16, 14, 0.46);
        color: #f8fafc;
        border: none;
        border-radius: 999px;
        padding: 10px 16px;
        min-height: 44px;
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
      }
      .wt-btn-text:hover, .wt-btn-text:focus-visible {
        background: rgba(6, 16, 14, 0.68);
        outline: 2px solid #a7f3d0;
        outline-offset: 2px;
      }
      .wt-dots {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 10px 0 4px;
        pointer-events: none;
      }
      .wt-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.48);
        transition: transform 220ms ease, background 220ms ease;
      }
      .wt-dot.active {
        background: #34d399;
        transform: scale(1.35);
      }
      .wt-pointer-svg {
        display: block;
        width: 32px;
        height: 24px;
        margin: 2px auto 0;
        pointer-events: none;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.7));
      }
      .wt-pointer-svg.up {
        transform: rotate(180deg);
        margin: 0 auto 4px;
      }
      /* Optional last-stop organic circular demo preview (no box) */
      .wt-demo-orb {
        width: 248px;
        height: 248px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 25%, rgba(16, 185, 129, 0.94), rgba(6, 78, 59, 0.95));
        padding: 24px 20px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 0 auto 18px;
        pointer-events: auto;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.42);
      }
      @media (prefers-reduced-motion: reduce) {
        .wt-backdrop, .wt-glow-ring, .wt-caption, .wt-intro-wrap, .wt-dot {
          transition: opacity 150ms ease !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  unbindTargetClick() {
    if (this.boundTargetEl && this.boundTargetHandler) {
      this.boundTargetEl.removeEventListener('click', this.boundTargetHandler, true);
    }
    this.boundTargetEl = null;
    this.boundTargetHandler = null;
  }

  clearRuntime() {
    if (this.glideRafId !== null) { cancelAnimationFrame(this.glideRafId); this.glideRafId = null; }
    this.unbindTargetClick();
    if (this.resizeObs) { try { this.resizeObs.disconnect(); } catch (_e) {} this.resizeObs = null; }
    this.cleanupFns.forEach((fn) => { try { fn(); } catch (_e) {} });
    this.cleanupFns = [];
  }

  destroyDom(restoreTab = true) {
    this.clearRuntime();
    this.restoreExtractSnapshot(restoreTab);
    if (this.root) { this.root.remove(); this.root = null; }
    this.backdropEl = null;
    this.glowEl = null;
    this.captionEl = null;
    this.active = false;
    if (this.previouslyFocusedEl && typeof this.previouslyFocusedEl.focus === 'function') {
      try { this.previouslyFocusedEl.focus(); } catch (_e) {}
    }
    this.previouslyFocusedEl = null;
  }

  applyBackdropMask(cx, cy, r) {
    if (!this.backdropEl) return;
    if (!r || r <= 0) {
      this.backdropEl.style.maskImage = 'none';
      this.backdropEl.style.webkitMaskImage = 'none';
      return;
    }
    const inner = Math.max(0, Math.round(r - 12));
    const mid = Math.round(r + 2);
    const outer = Math.round(r + 30);
    const grad = `radial-gradient(circle at ${Math.round(cx)}px ${Math.round(cy)}px, transparent 0px, transparent ${inner}px, rgba(0,0,0,0.45) ${mid}px, black ${outer}px)`;
    this.backdropEl.style.maskImage = grad;
    this.backdropEl.style.webkitMaskImage = grad;
  }

  glideSpotlightTo(targetCircle) {
    if (this.glideRafId !== null) {
      cancelAnimationFrame(this.glideRafId);
      this.glideRafId = null;
    }
    const from = { ...this.currentCircle };
    const to = { ...targetCircle };

    if (this.reducedMotion || from.r <= 0) {
      this.currentCircle = to;
      this.applyBackdropMask(to.cx, to.cy, to.r);
      return;
    }

    const duration = 360;
    const startTs = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      if (!this.active || this.phase !== 'tour') { this.glideRafId = null; return; }
      const p = Math.min(1, (now - startTs) / duration);
      const e = easeOutCubic(p);
      const cx = from.cx + (to.cx - from.cx) * e;
      const cy = from.cy + (to.cy - from.cy) * e;
      const r = from.r + (to.r - from.r) * e;
      this.currentCircle = { cx, cy, r };
      this.applyBackdropMask(cx, cy, r);
      if (p < 1) {
        this.glideRafId = requestAnimationFrame(step);
      } else {
        this.glideRafId = null;
      }
    };
    this.glideRafId = requestAnimationFrame(step);
  }

  ensureRoot() {
    if (this.root) return this.root;
    this.injectStyles();
    const root = document.createElement('div');
    root.id = 'welcome-tour-root';
    root.className = 'wt-root';
    document.body.appendChild(root);

    const backdrop = document.createElement('div');
    backdrop.className = 'wt-backdrop';
    root.appendChild(backdrop);

    this.root = root;
    this.backdropEl = backdrop;
    return root;
  }

  renderIntro() {
    this.phase = 'intro';
    this.ensureRoot();
    this.applyBackdropMask(0, 0, 0);
    if (this.glowEl) { this.glowEl.remove(); this.glowEl = null; }
    if (this.captionEl) { this.captionEl.remove(); this.captionEl = null; }

    const wrap = document.createElement('div');
    wrap.className = 'wt-intro-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-label', 'ברוך הבא');
    wrap.innerHTML = `
      <h2 class="wt-welcome-title">ברוך הבא</h2>
      <p class="wt-welcome-sub">סיור קצר באפליקציה — חופשי לדלג בכל רגע.</p>
      <div class="wt-controls">
        <button type="button" class="wt-btn-pill" id="wt-start-btn">בוא נתחיל</button>
        <button type="button" class="wt-btn-text" id="wt-skip-btn">דלג</button>
      </div>
    `;
    this.root.appendChild(wrap);

    const startBtn = wrap.querySelector('#wt-start-btn');
    const skipBtn = wrap.querySelector('#wt-skip-btn');
    startBtn.onclick = () => {
      wrap.remove();
      this.startTourStops();
    };
    skipBtn.onclick = () => {
      this.markDone();
      this.destroyDom(true);
    };
    try { startBtn.focus(); } catch (_e) {}
  }

  startTourStops() {
    this.phase = 'tour';
    this.stopIndex = 0;

    const glow = document.createElement('div');
    glow.className = 'wt-glow-ring';
    glow.setAttribute('aria-hidden', 'true');
    this.root.appendChild(glow);
    this.glowEl = glow;

    const caption = document.createElement('div');
    caption.className = 'wt-caption';
    caption.setAttribute('role', 'dialog');
    caption.setAttribute('aria-modal', 'false');
    this.root.appendChild(caption);
    this.captionEl = caption;

    const onReflow = () => {
      if (this.active && this.phase === 'tour') this.positionCurrentStop(false);
    };
    window.addEventListener('resize', onReflow, { passive: true });
    window.addEventListener('orientationchange', onReflow, { passive: true });
    window.addEventListener('scroll', onReflow, { passive: true });
    this.cleanupFns.push(() => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('orientationchange', onReflow);
      window.removeEventListener('scroll', onReflow);
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(onReflow);
      this.resizeObs.observe(document.body);
    }

    this.renderStop(0);
  }

  findStopElement(stop) {
    if (!stop || !stop.selector) return null;
    const selectors = stop.selector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) return el;
    }
    return null;
  }

  positionCurrentStop(animateGlide = true) {
    const stop = TOUR_STOPS[this.stopIndex];
    if (!stop || !this.captionEl || !this.glowEl) return;

    const el = this.findStopElement(stop);
    let circle = null;
    if (el) {
      const r = el.getBoundingClientRect();
      // Cap spotlight radius cleanly so wide inputs get a soft centered organic spotlight
      const rawR = Math.round(Math.max(r.width, r.height) / 2 + 12);
      const radius = Math.max(38, Math.min(Math.round(window.innerWidth * 0.44), rawR));
      circle = {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        r: radius
      };
      const dia = radius * 2;
      this.glowEl.style.opacity = '1';
      this.glowEl.style.width = `${dia}px`;
      this.glowEl.style.height = `${dia}px`;
      this.glowEl.style.transform = `translate3d(${Math.round(circle.cx - radius)}px, ${Math.round(circle.cy - radius)}px, 0)`;
      if (animateGlide) {
        this.glideSpotlightTo(circle);
      } else {
        this.currentCircle = circle;
        this.applyBackdropMask(circle.cx, circle.cy, circle.r);
      }
    } else {
      this.glowEl.style.opacity = '0';
      this.applyBackdropMask(0, 0, 0);
    }

    const cw = this.captionEl.offsetWidth || Math.min(326, window.innerWidth - 24);
    const ch = this.captionEl.offsetHeight || 150;
    const pos = computeTourCaptionPos(circle, { width: window.innerWidth, height: window.innerHeight }, { width: cw, height: ch });
    this.captionEl.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;

    const ptr = this.captionEl.querySelector('.wt-pointer-svg');
    if (ptr) {
      ptr.classList.toggle('up', pos.pointerDir === 'up');
    }
  }

  renderStop(idx) {
    if (idx >= TOUR_STOPS.length) {
      this.markDone();
      this.destroyDom(true);
      return;
    }
    this.stopIndex = idx;
    const stop = TOUR_STOPS[idx];
    const isLast = idx === TOUR_STOPS.length - 1;

    // Enter real Extract tab & show harmless local demo stage for stops 1-3, restore on stop 4
    if (stop.extractDemoStage) {
      this.applyExtractDemoStage(stop.extractDemoStage);
    }

    this.unbindTargetClick();
    const el = this.findStopElement(stop);
    if (el && !stop.extractDemoStage) {
      this.boundTargetEl = el;
      this.boundTargetHandler = () => {
        setTimeout(() => {
          if (!this.active || this.phase !== 'tour') return;
          if (isLast) {
            this.markDone();
            this.destroyDom(false);
          } else {
            this.renderStop(this.stopIndex + 1);
          }
        }, 80);
      };
      el.addEventListener('click', this.boundTargetHandler, true);
    }

    this.captionEl.setAttribute('aria-label', stop.caption);
    this.captionEl.innerHTML = `
      <p class="wt-caption-text">${stop.caption}</p>
      <div class="wt-controls">
        <button type="button" class="wt-btn-pill" id="wt-next-btn">${isLast ? 'סיום' : 'הבא ←'}</button>
        ${isLast ? `<button type="button" class="wt-btn-text" id="wt-demo-btn">מתכון לדוגמה</button>` : ''}
        <button type="button" class="wt-btn-text" id="wt-skip-btn">דלג</button>
      </div>
      <div class="wt-dots" aria-hidden="true">
        ${TOUR_STOPS.map((_, i) => `<span class="wt-dot ${i === idx ? 'active' : ''}"></span>`).join('')}
      </div>
      <svg class="wt-pointer-svg" viewBox="0 0 36 28" aria-hidden="true">
        <path d="M18 2 C17 12, 18 18, 18 24 M11 18 L18 25 L25 18" fill="none" stroke="#6ee7b7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    const nextBtn = this.captionEl.querySelector('#wt-next-btn');
    const skipBtn = this.captionEl.querySelector('#wt-skip-btn');
    const demoBtn = this.captionEl.querySelector('#wt-demo-btn');

    nextBtn.onclick = () => {
      if (isLast) {
        this.markDone();
        this.destroyDom(true);
      } else {
        this.renderStop(this.stopIndex + 1);
      }
    };
    skipBtn.onclick = () => {
      this.markDone();
      this.destroyDom(true);
    };
    if (demoBtn) {
      demoBtn.onclick = () => this.renderOptionalDemoStop();
    }

    requestAnimationFrame(() => this.positionCurrentStop(true));
    try { nextBtn.focus(); } catch (_e) {}
  }

  renderOptionalDemoStop() {
    this.phase = 'demo';
    this.unbindTargetClick();
    if (this.glowEl) { this.glowEl.remove(); this.glowEl = null; }
    if (this.captionEl) { this.captionEl.remove(); this.captionEl = null; }
    this.applyBackdropMask(0, 0, 0);

    const r = WELCOME_DEMO_RECIPE;
    const wrap = document.createElement('div');
    wrap.className = 'wt-intro-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-label', r.title);
    wrap.innerHTML = `
      <div class="wt-demo-orb">
        <span style="font-size:2.1rem;">🍳</span>
        <div style="font-size:1.05rem; font-weight:900; color:#fff;">${r.title}</div>
        <div style="font-size:0.8rem; color:#d1fae5;">⏱️ ${r.totalTimeMinutes} דק׳ • 🍽️ ${r.servings} מנות</div>
        <div style="font-size:0.78rem; color:#ecfdf5; line-height:1.4;">${r.ingredients.map((i) => i.name).join(' • ')}</div>
      </div>
      <div class="wt-controls">
        <button type="button" class="wt-btn-pill" id="wt-demo-save-btn" ${this.demoSaved ? 'disabled' : ''}>${this.demoSaved ? '✓ נשמר בספר' : 'שמור לספר'}</button>
        <button type="button" class="wt-btn-text" id="wt-demo-done-btn">סיום</button>
      </div>
    `;
    this.root.appendChild(wrap);

    const saveBtn = wrap.querySelector('#wt-demo-save-btn');
    const doneBtn = wrap.querySelector('#wt-demo-done-btn');
    saveBtn.onclick = () => {
      if (this.demoSaved) return;
      this.demoSaved = true;
      saveBtn.disabled = true;
      saveBtn.textContent = '✓ נשמר בספר';
      try { this.hooks.saveDemoRecipe?.({ ...WELCOME_DEMO_RECIPE }); } catch (_e) {}
    };
    doneBtn.onclick = () => {
      this.markDone();
      this.destroyDom(true);
    };
    try { doneBtn.focus(); } catch (_e) {}
  }

  start({ force = false } = {}) {
    if (this.active) return;
    if (!force && localStorage.getItem(WELCOME_GUIDE_KEY) === 'done') return;
    this.active = true;
    this.demoSaved = false;
    this.initialTab = (typeof this.hooks.getCurrentTab === 'function' ? this.hooks.getCurrentTab() : null) || 'library';
    this.previouslyFocusedEl = typeof document !== 'undefined' ? document.activeElement : null;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        this.markDone();
        this.destroyDom(true);
      }
    };
    document.addEventListener('keydown', onKey);
    this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));

    this.renderIntro();
  }
}

let singletonGuide = null;

export function startWelcomeGuide(hooks = {}, options = {}) {
  try {
    if (!singletonGuide) {
      singletonGuide = new LiveWelcomeTourController(hooks);
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
