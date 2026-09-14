export function getWebClientHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Social Recipe Extractor - Web App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --surface: #111827;
      --surface-card: #1f2937;
      --border: #374151;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --accent: #10b981;
      --accent-hover: #059669;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --warning: #f59e0b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
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

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon {
      font-size: 24px;
      background: rgba(59, 130, 246, 0.15);
      padding: 6px;
      border-radius: 8px;
    }

    .brand-name {
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #60a5fa, #38bdf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.1);
      color: var(--accent);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent);
    }

    nav.tab-bar {
      display: flex;
      gap: 8px;
      background: var(--surface);
      padding: 10px 24px;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      background: var(--surface-card);
      color: var(--text);
    }

    .tab-btn.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: var(--primary);
      color: #60a5fa;
    }

    main {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      padding: 24px;
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
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }

    .title {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .input-row {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    input[type="text"] {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus {
      border-color: var(--primary);
    }

    button.btn-primary {
      background: var(--accent);
      color: #ffffff;
      border: none;
      padding: 14px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }

    button.btn-primary:hover { background: var(--accent-hover); }
    button.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .presets-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 12px;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }

    .preset-card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 14px 16px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .preset-card:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
    }

    .preset-card-title {
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 4px;
    }

    .preset-card-url {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Stepper & Progress */
    .progress-box {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: none;
    }

    .progress-title {
      font-weight: 700;
      color: #60a5fa;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stepper {
      display: flex;
      align-items: center;
      margin-top: 16px;
      padding: 0 10px;
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
      border-color: var(--primary);
      background: var(--primary);
      color: #ffffff;
    }

    .step-line {
      flex: 1;
      height: 3px;
      background: var(--border);
    }

    .step-line.active { background: var(--primary); }

    /* Recipe Viewer */
    .recipe-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .badge-platform {
      background: #e11d48;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .meta-pills {
      display: flex;
      gap: 16px;
      background: var(--surface-card);
      padding: 14px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid var(--border);
    }

    .meta-pill-item {
      flex: 1;
      text-align: center;
    }

    .meta-pill-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .meta-pill-val {
      font-size: 1.1rem;
      font-weight: 700;
      color: #38bdf8;
    }

    /* Servings Scaler */
    .scaler-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .scaler-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: bold;
      cursor: pointer;
    }

    .scaler-btn:hover { background: var(--border); }

    /* Checklist & Items */
    .item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .item-row.checked {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 2px solid var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
    }

    .item-row.checked .checkbox {
      background: var(--accent);
      border-color: var(--accent);
    }

    .step-card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 12px;
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
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 800;
    }

    .timer-btn {
      background: var(--surface);
      border: 1px solid var(--warning);
      color: var(--warning);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .timer-btn.active {
      background: var(--warning);
      color: #000;
    }

    .category-title {
      font-size: 0.9rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #60a5fa;
      margin: 16px 0 8px;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <span class="brand-icon">🥑</span>
      <span class="brand-name">Social Recipe Extractor</span>
    </div>
    <div class="status-badge">
      <span class="status-dot"></span>
      API Online (Port 3001)
    </div>
  </header>

  <nav class="tab-bar">
    <button class="tab-btn active" onclick="switchTab('extract')">✨ Extract</button>
    <button class="tab-btn" onclick="switchTab('recipe')">🍳 Recipe Card</button>
    <button class="tab-btn" onclick="switchTab('shopping')">🛒 Grocery List</button>
    <button class="tab-btn" onclick="switchTab('library')">📚 Saved Recipes (<span id="saved-count">0</span>)</button>
  </nav>

  <main>
    <!-- TAB 1: EXTRACT -->
    <div id="panel-extract" class="panel active">
      <div class="card">
        <div class="title">Social Video Recipe Extractor</div>
        <div class="subtitle">Intercept Instagram Reels, TikTok, YouTube Shorts, and Facebook cooking videos.</div>

        <div class="input-row">
          <input type="text" id="url-input" placeholder="https://www.instagram.com/reel/... or https://www.tiktok.com/@..."/>
          <button class="btn-primary" id="extract-btn" onclick="triggerExtract()">✨ Extract Recipe</button>
        </div>

        <div id="progress-box" class="progress-box">
          <div class="progress-title" id="progress-title">⏳ Contacting Media Pipeline...</div>
          <div id="progress-detail" style="font-size:0.85rem; color: var(--text-muted);">Fetching post metadata and captions...</div>
          <div class="stepper">
            <div class="step-node active" id="st-1">1</div>
            <div class="step-line" id="sl-1"></div>
            <div class="step-node" id="st-2">2</div>
            <div class="step-line" id="sl-2"></div>
            <div class="step-node" id="st-3">3</div>
          </div>
        </div>

        <div class="presets-title">Quick Demo Links</div>
        <div class="presets-grid">
          <div class="preset-card" onclick="loadPreset('https://www.instagram.com/reel/spaghetti-carbonara-authentic')">
            <div class="preset-card-title">🍝 Instagram: Spaghetti Carbonara</div>
            <div class="preset-card-url">Classic Roman carbonara with guanciale & pecorino</div>
          </div>
          <div class="preset-card" onclick="loadPreset('https://www.tiktok.com/@chef/video/shakshuka-breakfast')">
            <div class="preset-card-title">🍳 TikTok: Shakshuka Breakfast</div>
            <div class="preset-card-url">Poached eggs in spiced tomato bell-pepper sauce</div>
          </div>
          <div class="preset-card" onclick="loadPreset('https://youtube.com/shorts/homemade-pancakes-recipe')">
            <div class="preset-card-title">🥞 YouTube: Homemade Pancakes</div>
            <div class="preset-card-url">Quick fluffy pancakes with Whisper STT fallback</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: RECIPE CARD -->
    <div id="panel-recipe" class="panel">
      <div class="card" id="recipe-card-content">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;">📖</div>
          <h3>No recipe active yet</h3>
          <p style="margin-top: 8px;">Extract a recipe from Instagram, TikTok, or YouTube to view details.</p>
        </div>
      </div>
    </div>

    <!-- TAB 3: SHOPPING LIST -->
    <div id="panel-shopping" class="panel">
      <div class="card" id="shopping-card-content">
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🛒</div>
          <h3>Shopping list is empty</h3>
          <p style="margin-top: 8px;">Your categorized grocery list will appear here automatically.</p>
        </div>
      </div>
    </div>

    <!-- TAB 4: SAVED RECIPES -->
    <div id="panel-library" class="panel">
      <div class="card">
        <div class="title">Saved Recipe Book</div>
        <div class="subtitle">Persisted recipes stored in your local backend database.</div>
        <div id="library-list" style="margin-top: 16px;"></div>
      </div>
    </div>
  </main>

  <script>
    let currentRecipe = null;
    let servingMultiplier = 1;
    let savedRecipes = [];

    async function init() {
      await fetchSavedRecipes();
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId));
      if (activeBtn) activeBtn.classList.add('active');
      const panel = document.getElementById('panel-' + tabId);
      if (panel) panel.classList.add('active');
    }

    function loadPreset(url) {
      document.getElementById('url-input').value = url;
      triggerExtract();
    }

    async function triggerExtract() {
      const url = document.getElementById('url-input').value.trim();
      if (!url) return;

      const btn = document.getElementById('extract-btn');
      const progressBox = document.getElementById('progress-box');
      const pTitle = document.getElementById('progress-title');
      const pDetail = document.getElementById('progress-detail');

      btn.disabled = true;
      progressBox.style.display = 'block';
      pTitle.textContent = '⏳ Step 1/3: Ingesting Social URL...';
      pDetail.textContent = 'Interception & media metadata retrieval for ' + url;
      document.getElementById('st-1').classList.add('active');

      try {
        const res = await fetch('/api/v1/recipes/fast-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceUrl: url })
        });

        if (!res.ok) throw new Error(await res.text());

        // Visual progression
        document.getElementById('sl-1').classList.add('active');
        document.getElementById('st-2').classList.add('active');
        pTitle.textContent = '🎙️ Step 2/3: Transcribing Audio Stream (Whisper Fallback)...';
        pDetail.textContent = 'Audio track processed & extracted without hallucinations';

        await new Promise(r => setTimeout(r, 600));

        document.getElementById('sl-2').classList.add('active');
        document.getElementById('st-3').classList.add('active');
        pTitle.textContent = '🧠 Step 3/3: LLM Parsing Canonical Schema...';
        pDetail.textContent = 'Validating ingredients, measurements & categorized shopping items';

        await new Promise(r => setTimeout(r, 500));

        const recipe = await res.json();
        currentRecipe = recipe;
        servingMultiplier = 1;
        renderRecipe();
        renderShopping();
        await fetchSavedRecipes();

        btn.disabled = false;
        progressBox.style.display = 'none';
        switchTab('recipe');
      } catch (err) {
        btn.disabled = false;
        pTitle.textContent = '❌ Error';
        pDetail.textContent = err.message;
      }
    }

    function renderRecipe() {
      if (!currentRecipe) return;
      const baseServings = currentRecipe.servings || 4;
      const servings = Math.round(baseServings * servingMultiplier);

      let html = \`
        <div class="recipe-header">
          <div>
            <span class="badge-platform">\${currentRecipe.platform}</span>
            <h1 class="title" style="margin-top: 10px;">\${currentRecipe.title}</h1>
            <p class="subtitle">\${currentRecipe.description}</p>
          </div>
        </div>

        <div class="meta-pills">
          <div class="meta-pill-item">
            <div class="meta-pill-label">PREP</div>
            <div class="meta-pill-val">\${currentRecipe.prepTimeMinutes ? currentRecipe.prepTimeMinutes + 'm' : '--'}</div>
          </div>
          <div class="meta-pill-item">
            <div class="meta-pill-label">COOK</div>
            <div class="meta-pill-val">\${currentRecipe.cookTimeMinutes ? currentRecipe.cookTimeMinutes + 'm' : '--'}</div>
          </div>
          <div class="meta-pill-item">
            <div class="meta-pill-label">TOTAL</div>
            <div class="meta-pill-val">\${currentRecipe.totalTimeMinutes ? currentRecipe.totalTimeMinutes + 'm' : '--'}</div>
          </div>
        </div>

        <div class="scaler-card">
          <span style="font-weight: 600;">Servings: <strong>\${servings}</strong> (\${servingMultiplier}x multiplier)</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="scaler-btn" onclick="scaleServings(-0.5)">-</button>
            <button class="scaler-btn" onclick="scaleServings(0.5)">+</button>
          </div>
        </div>

        <h3 style="margin-bottom: 12px; font-weight: 700;">Ingredients (\${currentRecipe.ingredients.length})</h3>
        <div id="ingredients-list">
          \${currentRecipe.ingredients.map(ing => {
            const scaled = ing.amount !== null ? (ing.amount * servingMultiplier).toFixed(ing.amount % 1 === 0 ? 0 : 1) : null;
            const amountText = scaled && ing.unit ? scaled + ' ' + ing.unit : '';
            return \`
              <div class="item-row" onclick="this.classList.toggle('checked')">
                <div class="checkbox">✓</div>
                <div style="flex: 1;">
                  <strong>\${amountText}</strong> \${ing.name}
                  <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 8px;">[\${ing.category}]</span>
                </div>
              </div>
            \`;
          }).join('')}
        </div>

        <h3 style="margin: 24px 0 12px; font-weight: 700;">Instructions</h3>
        <div>
          \${currentRecipe.instructions.map(step => \`
            <div class="step-card">
              <div class="step-header">
                <div class="step-badge">\${step.stepNumber}</div>
                \${step.durationMinutes ? \`<button class="timer-btn" onclick="this.classList.toggle('active')">⏱ \${step.durationMinutes} min</button>\` : ''}
              </div>
              <p style="font-size: 0.95rem; line-height: 1.5;">\${step.instruction}</p>
              \${step.tip ? \`<div style="margin-top: 8px; font-size: 0.85rem; color: #fbbf24;">💡 Tip: \${step.tip}</div>\` : ''}
            </div>
          \`).join('')}
        </div>
      \`;

      document.getElementById('recipe-card-content').innerHTML = html;
    }

    function scaleServings(delta) {
      servingMultiplier = Math.max(0.5, servingMultiplier + delta);
      renderRecipe();
    }

    function renderShopping() {
      if (!currentRecipe || !currentRecipe.shoppingList) return;

      const categoryEmoji = {
        produce: '🥬',
        dairy: '🧀',
        meat: '🥩',
        pantry: '🥫',
        spices: '🧂',
        bakery: '🥖',
        other: '📦'
      };

      let html = \`
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <div style="color: #38bdf8; font-size: 0.8rem; font-weight: 700;">\${currentRecipe.title.toUpperCase()}</div>
            <h2 class="title" style="margin-top: 4px;">Categorized Grocery List</h2>
          </div>
          <button class="scaler-btn" style="width: auto; padding: 6px 14px; font-size: 0.85rem;" onclick="clearCheckedShopping()">Clear Checked</button>
        </div>
      \`;

      for (const group of currentRecipe.shoppingList) {
        const emoji = categoryEmoji[group.category.toLowerCase()] || '📦';
        html += \`
          <div class="category-title">\${emoji} \${group.category} (\${group.items.length})</div>
          \${group.items.map(item => \`
            <div class="item-row" onclick="this.classList.toggle('checked')">
              <div class="checkbox">✓</div>
              <span>\${item}</span>
            </div>
          \`).join('')}
        \`;
      }

      document.getElementById('shopping-card-content').innerHTML = html;
    }

    function clearCheckedShopping() {
      document.querySelectorAll('#shopping-card-content .item-row.checked').forEach(el => el.classList.remove('checked'));
    }

    async function fetchSavedRecipes() {
      try {
        const res = await fetch('/api/v1/recipes');
        const data = await res.json();
        savedRecipes = data.recipes || [];
        document.getElementById('saved-count').textContent = savedRecipes.length;

        const container = document.getElementById('library-list');
        if (savedRecipes.length === 0) {
          container.innerHTML = '<p style="color: var(--text-muted);">No saved recipes yet. Extract a recipe to start your collection.</p>';
          return;
        }

        container.innerHTML = savedRecipes.map(r => \`
          <div class="item-row" style="cursor: default;">
            <div style="flex: 1;">
              <span class="badge-platform" style="font-size: 0.65rem; padding: 2px 6px;">\${r.platform}</span>
              <strong style="margin-left: 8px; font-size: 1rem;">\${r.title}</strong>
              <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">\${r.ingredients.length} ingredients • \${r.totalTimeMinutes ? r.totalTimeMinutes + 'm total' : ''}</div>
            </div>
            <button class="scaler-btn" style="width: auto; padding: 4px 12px; font-size: 0.8rem; margin-right: 8px;" onclick='selectSavedRecipe("\${r.id}")'>Open</button>
            <button class="scaler-btn" style="color: var(--danger); width: auto; padding: 4px 10px; font-size: 0.8rem;" onclick='deleteSavedRecipe("\${r.id}")'>✕</button>
          </div>
        \`).join('');
      } catch (e) {
        console.error('Failed to fetch recipes:', e);
      }
    }

    function selectSavedRecipe(id) {
      const r = savedRecipes.find(x => x.id === id);
      if (r) {
        currentRecipe = r;
        servingMultiplier = 1;
        renderRecipe();
        renderShopping();
        switchTab('recipe');
      }
    }

    async function deleteSavedRecipe(id) {
      await fetch('/api/v1/recipes/' + id, { method: 'DELETE' });
      await fetchSavedRecipes();
      if (currentRecipe && currentRecipe.id === id) {
        currentRecipe = null;
        document.getElementById('recipe-card-content').innerHTML = '<p style="color: var(--text-muted); text-align: center;">Recipe deleted.</p>';
        document.getElementById('shopping-card-content').innerHTML = '<p style="color: var(--text-muted); text-align: center;">Shopping list cleared.</p>';
      }
    }

    window.onload = init;
  </script>
</body>
</html>`;
}
