import {
  DEFAULT_STAPLES,
  normalizeIngredientName,
  buildIngredientSuggestionsIndex,
  searchSuggestions,
  rankRecipesByPantry
} from './pantry-search-engine.js';

export const PANTRY_SEARCH_STORAGE_KEY = 'pantrySearch.v1';

const VALID_FILTERS = new Set(['all', '90plus', '100', 'missing2']);
const STYLE_ELEMENT_ID = 'pantry-search-ui-styles';
const SUGGESTION_DEBOUNCE_MS = 150;
const MAX_VISIBLE_MISSING_TAGS = 4;

const FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: '90plus', label: '90%+' },
  { value: '100', label: 'אפשר לבשל עכשיו (100%)' },
  { value: 'missing2', label: 'חסר עד 2 מרכיבים' }
];

const DEFAULT_STATE = Object.freeze({
  chips: [],
  assumeStaples: true,
  filter: 'all'
});

/**
 * Escapes HTML special characters to prevent XSS when rendering user content.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely normalizes an ingredient string for deduplication and matching.
 * @param {unknown} value
 * @returns {string}
 */
function safeNormalize(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const normalized = normalizeIngredientName(raw);
    return typeof normalized === 'string' ? normalized.trim() : raw.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Extracts a display label from either a string or an ingredient/suggestion object.
 * @param {unknown} item
 * @returns {string}
 */
function extractLabel(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const candidate = item.label ?? item.name ?? item.display ?? item.raw ?? item.normalized ?? '';
    return String(candidate).trim();
  }
  return '';
}

/**
 * Sanitizes and deduplicates an array of chip strings.
 * @param {unknown} rawChips
 * @returns {string[]}
 */
function sanitizeChips(rawChips) {
  if (!Array.isArray(rawChips)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of rawChips) {
    const label = extractLabel(entry);
    if (!label) continue;
    const key = safeNormalize(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/**
 * Sanitizes persisted or incoming pantry search state.
 * @param {unknown} rawState
 * @returns {{ chips: string[], assumeStaples: boolean, filter: string }}
 */
function sanitizeState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return { chips: [], assumeStaples: true, filter: 'all' };
  }
  const chips = sanitizeChips(rawState.chips);
  const assumeStaples = typeof rawState.assumeStaples === 'boolean'
    ? rawState.assumeStaples
    : DEFAULT_STATE.assumeStaples;
  const filter = typeof rawState.filter === 'string' && VALID_FILTERS.has(rawState.filter)
    ? rawState.filter
    : DEFAULT_STATE.filter;
  return { chips, assumeStaples, filter };
}

/**
 * Loads pantry search state safely from localStorage.
 * @returns {{ chips: string[], assumeStaples: boolean, filter: string }}
 */
export function loadPantrySearchState() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return { chips: [], assumeStaples: true, filter: 'all' };
    }
    const raw = localStorage.getItem(PANTRY_SEARCH_STORAGE_KEY);
    if (!raw) {
      return { chips: [], assumeStaples: true, filter: 'all' };
    }
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch {
    return { chips: [], assumeStaples: true, filter: 'all' };
  }
}

/**
 * Persists pantry search state safely to localStorage.
 * @param {{ chips?: string[], assumeStaples?: boolean, filter?: string }} state
 * @returns {boolean}
 */
export function savePantrySearchState(state) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return false;
    }
    const clean = sanitizeState(state);
    localStorage.setItem(PANTRY_SEARCH_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts total cook time in minutes from a recipe object if available.
 * @param {Record<string, any>} recipe
 * @returns {number | null}
 */
function getRecipeCookMinutes(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  if (Number.isFinite(recipe.totalTimeMinutes) && recipe.totalTimeMinutes > 0) {
    return Math.round(recipe.totalTimeMinutes);
  }
  const prep = Number(recipe.prepTimeMinutes) || 0;
  const cook = Number(recipe.cookTimeMinutes) || 0;
  if (prep + cook > 0) {
    return Math.round(prep + cook);
  }
  if (Number.isFinite(recipe.cookTime) && recipe.cookTime > 0) {
    return Math.round(recipe.cookTime);
  }
  if (Number.isFinite(recipe.totalTime) && recipe.totalTime > 0) {
    return Math.round(recipe.totalTime);
  }
  return null;
}

/**
 * Applies the selected filter defensively in case the ranking engine returns unfiltered results.
 * @param {Array<Record<string, any>>} ranked
 * @param {string} filter
 * @returns {Array<Record<string, any>>}
 */
function applyResultFilter(ranked, filter) {
  if (!Array.isArray(ranked)) return [];
  if (filter === '100') {
    return ranked.filter((item) => Math.round(Number(item.score) || 0) === 100);
  }
  if (filter === '90plus') {
    return ranked.filter((item) => Math.round(Number(item.score) || 0) >= 90);
  }
  if (filter === 'missing2') {
    return ranked.filter((item) => {
      const missingArr = Array.isArray(item.missingIngredients)
        ? item.missingIngredients
        : (Array.isArray(item.missing) ? item.missing : null);
      const missingLen = missingArr
        ? missingArr.length
        : (Number.isFinite(item.missingCount) ? item.missingCount : 0);
      return missingLen <= 2;
    });
  }
  return ranked;
}

/**
 * Injects scoped RTL styles for the Pantry Search view once into document.head.
 */
function injectStyles() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .ps-root {
      direction: rtl;
      text-align: start;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      min-height: 100%;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      padding-block-start: 12px;
      padding-block-end: 96px;
      padding-inline: 14px;
      gap: 14px;
      box-sizing: border-box;
    }

    .ps-root *,
    .ps-root *::before,
    .ps-root *::after {
      box-sizing: border-box;
    }

    .ps-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding-block: 12px;
      padding-inline: 14px;
    }

    .ps-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .ps-back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      min-width: 44px;
      padding-block: 8px;
      padding-inline: 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-card);
      color: var(--text);
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
    }

    .ps-back-btn:hover {
      border-color: var(--primary);
    }

    .ps-back-btn:focus-visible,
    .ps-action-btn:focus-visible,
    .ps-filter-chip:focus-visible,
    .ps-chip-remove:focus-visible,
    .ps-suggestion-item:focus-visible,
    .ps-card-shopping-btn:focus-visible,
    .ps-empty-cta:focus-visible,
    .ps-result-card:focus-visible,
    .ps-input:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    .ps-title {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1.3;
    }

    .ps-subtitle {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .ps-controls-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding-block: 14px;
      padding-inline: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ps-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .ps-chips-wrap:empty {
      display: none;
    }

    .ps-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      min-height: 44px;
      max-width: 100%;
      padding-inline-start: 14px;
      padding-inline-end: 2px;
      border-radius: 999px;
      background: var(--surface-card);
      border: 1px solid var(--primary);
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 600;
    }

    .ps-chip-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 220px;
    }

    .ps-chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1;
      border-radius: 999px;
      cursor: pointer;
      padding: 0;
    }

    .ps-chip-remove:hover {
      color: var(--text);
      background: var(--border);
    }

    .ps-input-box {
      position: relative;
      width: 100%;
      min-width: 0;
    }

    .ps-input {
      width: 100%;
      min-height: 46px;
      padding-block: 10px;
      padding-inline: 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background: var(--surface-card);
      color: var(--text);
      font-family: inherit;
      font-size: 0.95rem;
      text-align: start;
    }

    .ps-input::placeholder {
      color: var(--text-muted);
    }

    .ps-input:focus {
      border-color: var(--primary);
    }

    .ps-suggestions {
      position: absolute;
      inset-inline-start: 0;
      inset-inline-end: 0;
      top: calc(100% + 4px);
      z-index: 40;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.14);
      max-height: 240px;
      overflow-y: auto;
      padding-block: 4px;
      margin: 0;
      list-style: none;
    }

    .ps-suggestions[hidden] {
      display: none;
    }

    .ps-suggestion-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      min-height: 44px;
      padding-block: 8px;
      padding-inline: 14px;
      border: none;
      background: transparent;
      color: var(--text);
      font-family: inherit;
      font-size: 0.94rem;
      text-align: start;
      cursor: pointer;
    }

    .ps-suggestion-item:hover,
    .ps-suggestion-item[aria-selected="true"] {
      background: var(--surface-card);
      color: var(--primary);
      font-weight: 600;
    }

    .ps-suggestion-count {
      font-size: 0.8rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .ps-actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .ps-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      padding-block: 8px;
      padding-inline: 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-card);
      color: var(--text);
      font-family: inherit;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      flex: 1 1 auto;
    }

    .ps-action-btn.ps-action-primary {
      border-color: var(--primary);
      color: var(--primary);
    }

    .ps-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ps-staples-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 44px;
      padding-block: 4px;
      padding-inline: 2px;
      cursor: pointer;
      user-select: none;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text);
    }

    .ps-switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      width: 48px;
      height: 28px;
    }

    .ps-switch input {
      position: absolute;
      opacity: 0;
      width: 44px;
      height: 44px;
      margin: 0;
      cursor: pointer;
      inset-inline-start: 0;
    }

    .ps-switch-track {
      width: 48px;
      height: 28px;
      border-radius: 999px;
      background: var(--border);
      position: relative;
      transition: background-color 150ms ease;
    }

    .ps-switch-thumb {
      position: absolute;
      top: 3px;
      inset-inline-start: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      transition: transform 150ms ease;
    }

    .ps-switch input:checked + .ps-switch-track {
      background: var(--primary);
    }

    .ps-switch input:checked + .ps-switch-track .ps-switch-thumb {
      transform: translateX(-20px);
    }

    .ps-switch input:focus-visible + .ps-switch-track {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    .ps-filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .ps-filter-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding-block: 8px;
      padding-inline: 14px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
    }

    .ps-filter-chip[aria-pressed="true"] {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--surface);
    }

    .ps-results-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .ps-results-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
      padding-inline: 2px;
    }

    .ps-results-count {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--text);
    }

    .ps-staples-note {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .ps-results-list {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      min-width: 0;
      animation: psFadeIn 130ms ease-out;
    }

    @keyframes psFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .ps-result-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding-block: 12px;
      padding-inline: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      cursor: pointer;
      min-width: 0;
      max-width: 100%;
    }

    .ps-result-card:hover {
      border-color: var(--primary);
    }

    .ps-card-top {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 0;
    }

    .ps-card-thumb-wrap {
      width: 72px;
      height: 72px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--surface-card);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
    }

    .ps-card-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .ps-card-info {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ps-card-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .ps-card-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .ps-score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding-block: 3px;
      padding-inline: 9px;
      border-radius: 999px;
      background: var(--surface-card);
      border: 1px solid var(--primary);
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 800;
      flex-shrink: 0;
    }

    .ps-card-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .ps-ready-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding-block: 2px;
      padding-inline: 8px;
      border-radius: 999px;
      background: var(--primary);
      color: var(--surface);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .ps-progress-track {
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: var(--surface-card);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .ps-progress-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--primary);
      transition: width 180ms ease;
    }

    .ps-ratio-text {
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--text);
    }

    .ps-missing-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .ps-missing-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .ps-missing-tag {
      display: inline-flex;
      align-items: center;
      padding-block: 3px;
      padding-inline: 8px;
      border-radius: 8px;
      background: var(--surface-card);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 0.8rem;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .ps-missing-more {
      font-weight: 700;
      color: var(--text-muted);
    }

    .ps-totaste-note {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .ps-card-shopping-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      min-height: 44px;
      padding-block: 8px;
      padding-inline: 12px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-card);
      color: var(--text);
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
    }

    .ps-card-shopping-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .ps-empty-state {
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: 16px;
      padding-block: 28px;
      padding-inline: 18px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .ps-empty-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .ps-empty-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--text);
    }

    .ps-empty-desc {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-muted);
      max-width: 420px;
      line-height: 1.5;
    }

    .ps-empty-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      padding-block: 10px;
      padding-inline: 18px;
      margin-block-start: 4px;
      border-radius: 12px;
      border: none;
      background: var(--primary);
      color: var(--surface);
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
    }

    @media (min-width: 768px) {
      .ps-root {
        padding-inline: 24px;
        gap: 16px;
      }

      .ps-actions-row {
        flex-wrap: nowrap;
      }

      .ps-action-btn {
        flex: 0 0 auto;
      }

      .ps-results-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ps-results-list,
      .ps-progress-fill,
      .ps-switch-track,
      .ps-switch-thumb {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Mounts the "What can I cook?" / Pantry Search RTL UI into containerEl.
 * @param {HTMLElement} containerEl
 * @param {object} hooks
 * @returns {{ refresh: () => void, focusInput: () => void, getState: () => object, restoreScroll: (y: number) => void, getScrollTop: () => number }}
 */
export function mountPantrySearch(containerEl, hooks = {}) {
  if (!containerEl) {
    throw new Error('mountPantrySearch requires a valid container element.');
  }

  injectStyles();

  const safeHooks = {
    getRecipes: typeof hooks.getRecipes === 'function' ? hooks.getRecipes : () => [],
    getPantryItems: typeof hooks.getPantryItems === 'function' ? hooks.getPantryItems : () => [],
    onOpenRecipe: typeof hooks.onOpenRecipe === 'function' ? hooks.onOpenRecipe : () => {},
    onAddMissingToShopping: typeof hooks.onAddMissingToShopping === 'function'
      ? hooks.onAddMissingToShopping
      : () => ({ added: 0, skipped: 0 }),
    onOpenDiscover: typeof hooks.onOpenDiscover === 'function' ? hooks.onOpenDiscover : () => {},
    onBack: typeof hooks.onBack === 'function' ? hooks.onBack : () => {},
    resolveImage: typeof hooks.resolveImage === 'function' ? hooks.resolveImage : () => '',
    showToast: typeof hooks.showToast === 'function' ? hooks.showToast : () => {}
  };

  let state = loadPantrySearchState();
  let cachedRecipes = [];
  let suggestionsIndex = null;
  let currentSuggestions = [];
  let activeSuggestionIndex = -1;
  let debounceTimer = null;

  containerEl.innerHTML = `
    <div class="ps-root" dir="rtl">
      <header class="ps-header">
        <div class="ps-header-top">
          <button type="button" class="ps-back-btn" id="pantry-back-btn" aria-label="חזרה לספר המתכונים">
            <span aria-hidden="true">←</span>
            <span>חזרה למתכונים</span>
          </button>
        </div>
        <h2 class="ps-title">🧑‍🍳 מה אפשר לבשל?</h2>
        <p class="ps-subtitle">בחרו מרכיבים שיש לכם בבית וגלו מה אפשר להכין עכשיו</p>
      </header>

      <section class="ps-controls-card" aria-label="בחירת מרכיבים">
        <div class="ps-chips-wrap" id="pantry-chips-wrap" role="list" aria-label="מרכיבים נבחרים"></div>

        <div class="ps-input-box">
          <input
            type="text"
            id="pantry-search-input"
            class="ps-input"
            autocomplete="off"
            role="combobox"
            placeholder="הקלידו מרכיב (למשל: בצל, עגבניות, ביצים)..."
            aria-label="הוספת מרכיב לחיפוש"
            aria-autocomplete="list"
            aria-controls="pantry-search-suggestions"
            aria-expanded="false"
          />
          <ul
            id="pantry-search-suggestions"
            class="ps-suggestions"
            role="listbox"
            aria-label="הצעות מרכיבים מהמתכונים שלך"
            hidden
          ></ul>
        </div>

        <div class="ps-actions-row">
          <button type="button" id="pantry-prefill-btn" class="ps-action-btn ps-action-primary">
            🏠 הוסף מ'יש בבית'
          </button>
          <button type="button" id="pantry-clear-chips-btn" class="ps-action-btn">
            🗑️ נקה הכל
          </button>
        </div>

        <label class="ps-staples-label" for="pantry-staples-toggle">
          <span>להניח שיש מלח, פלפל, שמן ומים</span>
          <span class="ps-switch">
            <input type="checkbox" id="pantry-staples-toggle" />
            <span class="ps-switch-track" aria-hidden="true">
              <span class="ps-switch-thumb"></span>
            </span>
          </span>
        </label>

        <div class="ps-filters-row" id="pantry-filters-row" role="group" aria-label="סינון תוצאות"></div>
      </section>

      <section class="ps-results-section" aria-live="polite" aria-label="תוצאות מתכונים">
        <div class="ps-results-header" id="pantry-results-header"></div>
        <div id="pantry-results-container"></div>
      </section>
    </div>
  `;

  const backBtn = containerEl.querySelector('#pantry-back-btn');
  const chipsWrapEl = containerEl.querySelector('#pantry-chips-wrap');
  const inputEl = containerEl.querySelector('#pantry-search-input');
  const suggestionsEl = containerEl.querySelector('#pantry-search-suggestions');
  const prefillBtn = containerEl.querySelector('#pantry-prefill-btn');
  const clearBtn = containerEl.querySelector('#pantry-clear-chips-btn');
  const staplesToggleEl = containerEl.querySelector('#pantry-staples-toggle');
  const filtersRowEl = containerEl.querySelector('#pantry-filters-row');
  const resultsHeaderEl = containerEl.querySelector('#pantry-results-header');
  const resultsContainerEl = containerEl.querySelector('#pantry-results-container');

  function rebuildIndex() {
    const list = safeHooks.getRecipes();
    cachedRecipes = Array.isArray(list) ? list : [];
    suggestionsIndex = buildIngredientSuggestionsIndex(cachedRecipes);
  }

  function closeSuggestions() {
    currentSuggestions = [];
    activeSuggestionIndex = -1;
    suggestionsEl.innerHTML = '';
    suggestionsEl.hidden = true;
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
  }

  function renderSuggestions() {
    if (!currentSuggestions.length) {
      closeSuggestions();
      return;
    }

    suggestionsEl.innerHTML = currentSuggestions.map((entry, idx) => {
      const label = extractLabel(entry);
      const count = entry && typeof entry === 'object' && Number.isFinite(entry.count)
        ? entry.count
        : null;
      const isSelected = idx === activeSuggestionIndex;
      const optionId = `pantry-suggestion-opt-${idx}`;
      return `
        <li role="presentation">
          <button
            type="button"
            id="${optionId}"
            class="ps-suggestion-item"
            role="option"
            aria-selected="${isSelected ? 'true' : 'false'}"
            data-suggestion-index="${idx}"
          >
            <span><bdi>${escapeHtml(label)}</bdi></span>
            ${count !== null ? `<span class="ps-suggestion-count"><bdi>${count}</bdi> מתכונים</span>` : ''}
          </button>
        </li>
      `;
    }).join('');

    suggestionsEl.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
      inputEl.setAttribute('aria-activedescendant', `pantry-suggestion-opt-${activeSuggestionIndex}`);
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }
  }

  function updateSuggestionsForQuery(query) {
    const trimmed = String(query ?? '').trim();
    if (!trimmed || !suggestionsIndex) {
      closeSuggestions();
      return;
    }
    const matches = searchSuggestions(suggestionsIndex, trimmed, state.chips);
    currentSuggestions = Array.isArray(matches) ? matches : [];
    activeSuggestionIndex = -1;
    renderSuggestions();
  }

  function addChips(rawItems) {
    const existingKeys = new Set(state.chips.map((chip) => safeNormalize(chip)));
    let addedCount = 0;

    for (const raw of rawItems) {
      const pieces = String(raw ?? '').split(',');
      for (const piece of pieces) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        const key = safeNormalize(trimmed);
        if (!key || existingKeys.has(key)) continue;
        existingKeys.add(key);
        state.chips.push(trimmed);
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      savePantrySearchState(state);
      renderChips();
      renderResults();
    }
    return addedCount;
  }

  function removeChipAt(index) {
    if (index < 0 || index >= state.chips.length) return;
    state.chips.splice(index, 1);
    savePantrySearchState(state);
    renderChips();
    renderResults();
  }

  function renderChips() {
    clearBtn.disabled = state.chips.length === 0;
    if (!state.chips.length) {
      chipsWrapEl.innerHTML = '';
      return;
    }

    chipsWrapEl.innerHTML = state.chips.map((chip, idx) => `
      <span class="ps-chip" role="listitem">
        <span class="ps-chip-label"><bdi>${escapeHtml(chip)}</bdi></span>
        <button
          type="button"
          class="ps-chip-remove"
          data-remove-index="${idx}"
          aria-label="הסר ${escapeHtml(chip)}"
        >×</button>
      </span>
    `).join('');
  }

  function renderFilters() {
    filtersRowEl.innerHTML = FILTER_OPTIONS.map((opt) => {
      const pressed = state.filter === opt.value;
      return `
        <button
          type="button"
          class="ps-filter-chip"
          data-filter="${opt.value}"
          aria-pressed="${pressed ? 'true' : 'false'}"
        >${escapeHtml(opt.label)}</button>
      `;
    }).join('');
  }

  function renderStaplesToggle() {
    staplesToggleEl.checked = Boolean(state.assumeStaples);
  }

  function renderResults() {
    const totalRecipes = cachedRecipes.length;
    const staplesNoteHtml = state.assumeStaples
      ? '<span class="ps-staples-note">מניחים שיש מלח, פלפל, שמן ומים במטבח</span>'
      : '';

    if (totalRecipes === 0) {
      resultsHeaderEl.innerHTML = '';
      resultsContainerEl.innerHTML = `
        <div class="ps-empty-state">
          <div class="ps-empty-icon" aria-hidden="true">📖</div>
          <h3 class="ps-empty-title">עדיין אין מתכונים בספר שלך</h3>
          <p class="ps-empty-desc">חלצו מתכון חדש או עיינו בגילוי מתכונים כדי להתחיל לבשל לפי מה שיש בבית</p>
          <button type="button" class="ps-empty-cta" data-action="discover">🧭 גלה מתכונים חדשים</button>
        </div>
      `;
      return;
    }

    if (state.chips.length === 0) {
      resultsHeaderEl.innerHTML = staplesNoteHtml;
      resultsContainerEl.innerHTML = `
        <div class="ps-empty-state">
          <div class="ps-empty-icon" aria-hidden="true">🥕</div>
          <h3 class="ps-empty-title">מה יש במקרר ובמזווה?</h3>
          <p class="ps-empty-desc">הוסיפו מרכיבים שיש לכם בבית או לחצו על 'הוסף מיש בבית' כדי לגלות מה אפשר לבשל</p>
        </div>
      `;
      return;
    }

    const rawRanked = rankRecipesByPantry(cachedRecipes, state.chips, {
      assumeStaples: state.assumeStaples,
      staples: DEFAULT_STAPLES,
      filter: state.filter
    });
    const results = applyResultFilter(rawRanked, state.filter);

    resultsHeaderEl.innerHTML = `
      <span class="ps-results-count">נמצאו <bdi>${results.length}</bdi> מתכונים</span>
      ${staplesNoteHtml}
    `;

    if (results.length === 0) {
      resultsContainerEl.innerHTML = `
        <div class="ps-empty-state">
          <div class="ps-empty-icon" aria-hidden="true">🔍</div>
          <h3 class="ps-empty-title">לא נמצא מתכון מתאים למרכיבים שנבחרו</h3>
          <p class="ps-empty-desc">נסו להוסיף עוד מרכיבים, לשנות את הסינון או לגלות מתכונים חדשים</p>
          <button type="button" class="ps-empty-cta" data-action="discover">🧭 גלה מתכונים חדשים</button>
        </div>
      `;
      return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'ps-results-list';

    results.forEach((item, idx) => {
      const recipe = item.recipe || cachedRecipes[item.recipeIndex] || {};
      const title = recipe.title || recipe.name || 'מתכון ללא שם';
      const score = Math.max(0, Math.min(100, Math.round(Number(item.score) || 0)));
      const missingList = Array.isArray(item.missingIngredients)
        ? item.missingIngredients
        : (Array.isArray(item.missing) ? item.missing : []);
      const toTasteList = Array.isArray(item.toTasteIngredients) ? item.toTasteIngredients : [];
      const matchedList = Array.isArray(item.matchedIngredients)
        ? item.matchedIngredients
        : (Array.isArray(item.matched) ? item.matched : []);
      const matchedCount = Number.isFinite(item.matchedCount)
        ? item.matchedCount
        : matchedList.length;
      const totalCount = Number.isFinite(item.totalCount)
        ? item.totalCount
        : (Number.isFinite(item.requiredCount)
          ? item.requiredCount
          : (matchedCount + missingList.length));
      const cookMinutes = Number.isFinite(item.totalTimeMinutes) && item.totalTimeMinutes > 0
        ? Math.round(item.totalTimeMinutes)
        : getRecipeCookMinutes(recipe);
      const imageUrl = safeHooks.resolveImage(recipe) || '';

      const visibleMissing = missingList.slice(0, MAX_VISIBLE_MISSING_TAGS);
      const extraMissingCount = Math.max(0, missingList.length - MAX_VISIBLE_MISSING_TAGS);

      const cardEl = document.createElement('article');
      cardEl.className = 'ps-result-card';
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('aria-label', `${title}, התאמה ${score}%`);
      cardEl.dataset.resultIdx = String(idx);

      const thumbHtml = imageUrl
        ? `<img class="ps-card-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`
        : '<span aria-hidden="true">🍽️</span>';

      const readyPillHtml = score === 100
        ? '<span class="ps-ready-pill">✨ אפשר לבשל עכשיו</span>'
        : '';

      const cookTimeHtml = cookMinutes !== null
        ? `<span>⏱️ <bdi>${cookMinutes}</bdi> דק'</span>`
        : '';

      const missingHtml = missingList.length > 0
        ? `
          <div class="ps-missing-row" aria-label="מרכיבים חסרים">
            <span class="ps-missing-label">חסר:</span>
            ${visibleMissing.map((m) => `<span class="ps-missing-tag"><bdi>${escapeHtml(extractLabel(m))}</bdi></span>`).join('')}
            ${extraMissingCount > 0 ? `<span class="ps-missing-tag ps-missing-more"><bdi>+${extraMissingCount}</bdi></span>` : ''}
          </div>
        `
        : '';

      const toTasteHtml = toTasteList.length > 0
        ? `<div class="ps-totaste-note">לפי הטעם: <bdi>${escapeHtml(toTasteList.map(extractLabel).filter(Boolean).join(', '))}</bdi></div>`
        : '';

      const shoppingBtnHtml = missingList.length > 0
        ? `<button type="button" class="ps-card-shopping-btn" data-action="add-missing">🛒 הוסף את החסר לרשימת הקניות</button>`
        : '';

      cardEl.innerHTML = `
        <div class="ps-card-top">
          <div class="ps-card-thumb-wrap">${thumbHtml}</div>
          <div class="ps-card-info">
            <div class="ps-card-title-row">
              <h3 class="ps-card-title"><bdi>${escapeHtml(title)}</bdi></h3>
              <span class="ps-score-badge"><bdi>${score}%</bdi></span>
            </div>
            <div class="ps-card-meta-row">
              ${readyPillHtml}
              ${cookTimeHtml}
            </div>
            <div class="ps-progress-track" aria-hidden="true">
              <div class="ps-progress-fill" style="width: ${score}%;"></div>
            </div>
            <div class="ps-ratio-text">יש לך: <bdi>${matchedCount}</bdi> מתוך <bdi>${totalCount}</bdi></div>
          </div>
        </div>
        ${missingHtml}
        ${toTasteHtml}
        ${shoppingBtnHtml}
      `;

      const imgEl = cardEl.querySelector('.ps-card-thumb');
      if (imgEl) {
        imgEl.addEventListener('error', () => {
          const wrap = imgEl.parentElement;
          if (wrap) {
            wrap.innerHTML = '<span aria-hidden="true">🍽️</span>';
          }
        });
      }

      const openThisRecipe = () => {
        const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
        safeHooks.onOpenRecipe(item.recipeIndex, recipe, scrollY);
      };

      cardEl.addEventListener('click', () => {
        openThisRecipe();
      });

      cardEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openThisRecipe();
        }
      });

      const addMissingBtn = cardEl.querySelector('[data-action="add-missing"]');
      if (addMissingBtn) {
        addMissingBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const missingStrings = missingList.map(extractLabel).filter(Boolean);
          const outcome = safeHooks.onAddMissingToShopping(missingStrings) || {};
          const added = Number(outcome.added) || 0;
          const skipped = Number(outcome.skipped) || 0;
          if (added > 0 && skipped > 0) {
            safeHooks.showToast(`נוספו ${added} מרכיבים לרשימת הקניות (${skipped} כבר היו ברשימה)`, 'success', '🛒');
          } else if (added > 0) {
            safeHooks.showToast(`נוספו ${added} מרכיבים לרשימת הקניות`, 'success', '🛒');
          } else if (skipped > 0) {
            safeHooks.showToast('כל המרכיבים החסרים כבר נמצאים ברשימת הקניות', 'info', '✅');
          }
        });
      }

      listEl.appendChild(cardEl);
    });

    resultsContainerEl.innerHTML = '';
    resultsContainerEl.appendChild(listEl);
  }

  // Event bindings
  backBtn.addEventListener('click', () => {
    closeSuggestions();
    safeHooks.onBack();
  });

  chipsWrapEl.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove-index]');
    if (!removeBtn) return;
    const idx = Number(removeBtn.dataset.removeIndex);
    if (Number.isInteger(idx)) {
      removeChipAt(idx);
    }
  });

  inputEl.addEventListener('input', () => {
    const val = inputEl.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      const completed = parts.slice(0, -1);
      const remainder = parts[parts.length - 1];
      addChips(completed);
      inputEl.value = remainder;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSuggestionsForQuery(inputEl.value);
    }, SUGGESTION_DEBOUNCE_MS);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      if (currentSuggestions.length > 0) {
        event.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
        renderSuggestions();
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (currentSuggestions.length > 0) {
        event.preventDefault();
        activeSuggestionIndex = activeSuggestionIndex <= 0
          ? currentSuggestions.length - 1
          : activeSuggestionIndex - 1;
        renderSuggestions();
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
        const chosen = extractLabel(currentSuggestions[activeSuggestionIndex]);
        if (chosen) addChips([chosen]);
      } else {
        const raw = inputEl.value.trim();
        if (raw) addChips([raw]);
      }
      inputEl.value = '';
      closeSuggestions();
      return;
    }

    if (event.key === 'Backspace' && inputEl.value === '' && state.chips.length > 0) {
      removeChipAt(state.chips.length - 1);
      return;
    }

    if (event.key === 'Escape') {
      if (!suggestionsEl.hidden) {
        event.preventDefault();
        closeSuggestions();
      }
    }
  });

  suggestionsEl.addEventListener('mousedown', (event) => {
    // Prevent input blur before click registers
    event.preventDefault();
  });

  suggestionsEl.addEventListener('click', (event) => {
    const optionBtn = event.target.closest('[data-suggestion-index]');
    if (!optionBtn) return;
    const idx = Number(optionBtn.dataset.suggestionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= currentSuggestions.length) return;
    const chosen = extractLabel(currentSuggestions[idx]);
    if (chosen) {
      addChips([chosen]);
    }
    inputEl.value = '';
    closeSuggestions();
    inputEl.focus();
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => {
      closeSuggestions();
    }, 120);
  });

  prefillBtn.addEventListener('click', () => {
    const pantryItems = safeHooks.getPantryItems();
    const list = Array.isArray(pantryItems)
      ? pantryItems.map(extractLabel).filter(Boolean)
      : [];
    if (list.length === 0) {
      safeHooks.showToast("רשימת 'יש בבית' ריקה כרגע", 'info', '🏠');
      return;
    }
    const added = addChips(list);
    if (added > 0) {
      safeHooks.showToast(`נוספו ${added} מרכיבים מ'יש בבית'`, 'success', '🏠');
    } else {
      safeHooks.showToast("כל המרכיבים מ'יש בבית' כבר נבחרו", 'info', '✅');
    }
  });

  clearBtn.addEventListener('click', () => {
    if (state.chips.length === 0) return;
    state.chips = [];
    savePantrySearchState(state);
    renderChips();
    renderResults();
    inputEl.focus();
  });

  staplesToggleEl.addEventListener('change', () => {
    state.assumeStaples = Boolean(staplesToggleEl.checked);
    savePantrySearchState(state);
    renderResults();
  });

  filtersRowEl.addEventListener('click', (event) => {
    const chipBtn = event.target.closest('[data-filter]');
    if (!chipBtn) return;
    const nextFilter = chipBtn.dataset.filter;
    if (!VALID_FILTERS.has(nextFilter) || state.filter === nextFilter) return;
    state.filter = nextFilter;
    savePantrySearchState(state);
    renderFilters();
    renderResults();
  });

  resultsContainerEl.addEventListener('click', (event) => {
    const discoverBtn = event.target.closest('[data-action="discover"]');
    if (discoverBtn) {
      safeHooks.onOpenDiscover();
    }
  });

  function refresh() {
    rebuildIndex();
    renderChips();
    renderStaplesToggle();
    renderFilters();
    renderResults();
  }

  function focusInput() {
    inputEl.focus();
  }

  function getState() {
    return {
      chips: [...state.chips],
      assumeStaples: state.assumeStaples,
      filter: state.filter
    };
  }

  function getScrollTop() {
    if (typeof window !== 'undefined' && Number.isFinite(window.scrollY)) {
      return window.scrollY;
    }
    return containerEl.scrollTop || 0;
  }

  function restoreScroll(y) {
    const targetY = Math.max(0, Number(y) || 0);
    const apply = () => {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, targetY);
      }
      if (containerEl) {
        containerEl.scrollTop = targetY;
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(apply);
    } else {
      apply();
    }
  }

  refresh();

  return {
    refresh,
    focusInput,
    getState,
    restoreScroll,
    getScrollTop
  };
}
