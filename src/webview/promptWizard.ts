// ---------------------------------------------------------------------------
// Prompt Wizard Webview HTML
//
// Multi-step wizard for generating/picking prompts, filling variables,
// previewing the resolved result, and pasting into Cursor chat.
//
// Steps:
//   1. Choose or Create (Browse Templates | Generate New)
//   2. Fill Variables (dynamic form from prompt schema)
//   2.5. AI Refine (optional, between steps 2 and 3)
//   3. Preview & Submit (copy to chat, insert in editor, save as template)
// ---------------------------------------------------------------------------

export function getPromptWizardHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Prompt Wizard</title>
  <style>
    :root {
      --primary: #7c3aed;
      --primary-light: #a78bfa;
      --primary-dim: rgba(124, 58, 237, 0.12);
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-input-border, rgba(128,128,128,0.35));
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --badge-bg: var(--vscode-badge-background, #7c3aed);
      --badge-fg: var(--vscode-badge-foreground, #fff);
      --muted: var(--vscode-descriptionForeground);
      --card-bg: var(--vscode-sideBar-background, rgba(0,0,0,0.1));
      --card-border: var(--vscode-panel-border, rgba(128,128,128,0.2));
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      line-height: 1.5;
    }

    /* ── Step Indicator ─────────────────────────────────────────────────── */
    .step-bar {
      display: flex;
      align-items: center;
      padding: 16px 24px 0;
      gap: 0;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
    }
    .step-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
      white-space: nowrap;
    }
    .step-pill.active { color: var(--fg); }
    .step-pill.done { color: var(--success); }
    .step-dot {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--card-bg);
      border: 1.5px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      flex-shrink: 0;
    }
    .step-pill.active .step-dot {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }
    .step-pill.done .step-dot {
      background: var(--success);
      border-color: var(--success);
      color: #fff;
    }
    .step-connector {
      flex: 1;
      height: 1px;
      background: var(--border);
      margin: 0 6px;
      min-width: 12px;
    }

    /* ── Layout ─────────────────────────────────────────────────────────── */
    .wizard-body {
      padding: 20px 24px;
      min-height: calc(100vh - 120px);
    }
    .step-panel { display: none; }
    .step-panel.active { display: block; }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .panel-subtitle {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 16px;
    }

    /* ── Tabs (Step 1) ───────────────────────────────────────────────────── */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }
    .tab-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s;
    }
    .tab-btn.active {
      color: var(--fg);
      border-bottom-color: var(--primary);
    }
    .tab-btn:hover { color: var(--fg); }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* ── Search Box ─────────────────────────────────────────────────────── */
    .search-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    input[type="text"], input[type="password"], textarea, select {
      width: 100%;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 5px;
      background: var(--input-bg);
      color: var(--input-fg);
      font-size: 13px;
      font-family: inherit;
    }
    input:focus, textarea:focus, select:focus {
      outline: 2px solid var(--primary);
      outline-offset: -1px;
    }
    textarea { resize: vertical; min-height: 80px; }
    select { cursor: pointer; }

    /* ── Prompt List (Step 1 Browse) ─────────────────────────────────────── */
    .prompt-list {
      max-height: 340px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .prompt-item {
      display: flex;
      flex-direction: column;
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--card-border);
      transition: background 0.1s;
    }
    .prompt-item:last-child { border-bottom: none; }
    .prompt-item:hover { background: var(--primary-dim); }
    .prompt-item.selected { background: var(--primary-dim); border-left: 3px solid var(--primary); padding-left: 9px; }
    .prompt-item-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .prompt-item-name { font-weight: 500; flex: 1; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
    }
    .prompt-item-desc {
      font-size: 11px;
      color: var(--muted);
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .prompt-list-empty {
      padding: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
    }

    /* ── Generate Section ───────────────────────────────────────────────── */
    .generate-section label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .generate-result {
      margin-top: 14px;
      display: none;
    }
    .generate-result.show { display: block; }
    .generated-preview {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--card-bg);
      padding: 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      margin-top: 8px;
    }

    /* ── Variables Form (Step 2) ─────────────────────────────────────────── */
    .var-form { display: flex; flex-direction: column; gap: 14px; }
    .var-field label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .var-field .required { color: var(--error); margin-left: 2px; }
    .var-field .var-help { font-size: 11px; color: var(--muted); margin-top: 3px; }
    .no-vars {
      padding: 20px;
      text-align: center;
      color: var(--muted);
      background: var(--card-bg);
      border-radius: 6px;
      border: 1px dashed var(--border);
    }

    /* ── Live Preview (inline, Step 2) ──────────────────────────────────── */
    .live-preview-wrap {
      margin-top: 16px;
      border-top: 1px solid var(--card-border);
      padding-top: 14px;
    }
    .live-preview-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .live-preview-box {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 10px 12px;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: var(--fg);
    }

    /* ── Refine Step ─────────────────────────────────────────────────────── */
    .refine-section label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .refine-result { margin-top: 12px; display: none; }
    .refine-result.show { display: block; }

    /* ── Preview Step (Step 3) ────────────────────────────────────────────── */
    .preview-box {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px 16px;
      max-height: 320px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .meta-row {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 14px;
    }
    .action-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-action-primary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
      width: 100%;
      justify-content: center;
    }
    .btn-action-primary:hover { opacity: 0.88; }
    .btn-action-secondary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s;
      width: 100%;
      justify-content: center;
    }
    .btn-action-secondary:hover { background: var(--primary-dim); }

    /* ── Toast ────────────────────────────────────────────────────────────── */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 16px;
      background: var(--success);
      color: #fff;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      pointer-events: none;
      z-index: 999;
    }
    .toast.show { opacity: 1; transform: translateY(0); }

    /* ── Nav Footer ─────────────────────────────────────────────────────── */
    .wizard-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid var(--card-border);
      position: sticky;
      bottom: 0;
      background: var(--bg);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: 5px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-primary { background: var(--button-bg); color: var(--button-fg); }
    .btn-primary:hover:not(:disabled) { opacity: 0.85; }
    .btn-secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
    .btn-secondary:hover:not(:disabled) { background: var(--primary-dim); }
    .btn-ghost { background: transparent; color: var(--muted); }
    .btn-ghost:hover { color: var(--fg); }

    /* ── Spinner ─────────────────────────────────────────────────────────── */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: none;
    }
    .loading .spinner { display: inline-block; }

    /* ── Status Messages ─────────────────────────────────────────────────── */
    .status-msg {
      padding: 10px 14px;
      border-radius: 5px;
      font-size: 12px;
      margin-top: 10px;
      display: none;
    }
    .status-msg.show { display: block; }
    .status-msg.error { background: rgba(239,68,68,0.1); border: 1px solid var(--error); color: var(--error); }
    .status-msg.info { background: var(--primary-dim); border: 1px solid var(--primary); }
    .status-msg.success { background: rgba(16,185,129,0.1); border: 1px solid var(--success); }

    .loading-text { color: var(--muted); font-size: 12px; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>

  <!-- Step Indicator Bar -->
  <div class="step-bar">
    <div class="step-pill active" id="pill-1">
      <div class="step-dot">1</div>
      <span>Choose</span>
    </div>
    <div class="step-connector"></div>
    <div class="step-pill" id="pill-2">
      <div class="step-dot">2</div>
      <span>Variables</span>
    </div>
    <div class="step-connector"></div>
    <div class="step-pill" id="pill-25">
      <div class="step-dot">~</div>
      <span>Refine</span>
    </div>
    <div class="step-connector"></div>
    <div class="step-pill" id="pill-3">
      <div class="step-dot">3</div>
      <span>Preview</span>
    </div>
  </div>

  <!-- Toast notification -->
  <div class="toast" id="toast"></div>

  <!-- ── STEP 1: Choose or Create ── -->
  <div class="wizard-body">
    <div class="step-panel active" id="step-1">
      <div class="panel-title">Choose or Create a Prompt</div>
      <div class="panel-subtitle">Browse team templates or generate a new prompt with AI.</div>

      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('browse')">Browse Templates</button>
        <button class="tab-btn" onclick="switchTab('generate')">Generate New</button>
      </div>

      <!-- Browse Tab -->
      <div class="tab-pane active" id="tab-browse">
        <div class="search-row">
          <input type="text" id="searchInput" placeholder="Search prompts..." oninput="filterPrompts(this.value)" style="flex:1" />
        </div>
        <div class="prompt-list" id="promptList">
          <div class="prompt-list-empty" id="promptListEmpty">Loading prompts...</div>
        </div>
        <div class="status-msg" id="browseError"></div>
      </div>

      <!-- Generate Tab -->
      <div class="tab-pane" id="tab-generate">
        <div class="generate-section">
          <label for="generateDesc">Describe what you need</label>
          <textarea id="generateDesc" placeholder="e.g. A prompt that helps review Go code for security vulnerabilities, checking for SQL injection, path traversal, and improper error handling..."></textarea>
        </div>
        <div style="margin-top: 8px;">
          <button class="btn btn-primary" id="generateBtn" onclick="generatePrompt()">
            <span class="spinner" id="generateSpinner"></span>
            <span id="generateBtnText">Generate Prompt</span>
          </button>
        </div>
        <div class="generate-result" id="generateResult">
          <div class="live-preview-label">Generated Prompt — review and edit before continuing</div>
          <textarea id="generatedContent" class="generated-preview" style="min-height:160px; width:100%; font-family: var(--vscode-editor-font-family, monospace); font-size:12px;"></textarea>
          <div style="margin-top: 8px; display: flex; gap: 8px;">
            <input type="text" id="generatedName" placeholder="Prompt name (e.g. Go Security Review)" style="flex:1" />
          </div>
        </div>
        <div class="status-msg" id="generateError"></div>
      </div>
    </div>

    <!-- ── STEP 2: Fill Variables ── -->
    <div class="step-panel" id="step-2">
      <div class="panel-title" id="step2Title">Fill in Variables</div>
      <div class="panel-subtitle" id="step2Subtitle">Customize the prompt by filling in the required fields.</div>

      <div id="varForm" class="var-form"></div>

      <div class="live-preview-wrap">
        <div class="live-preview-label">Live Preview</div>
        <div class="live-preview-box" id="livePreview">Fill in the fields above to see the preview.</div>
      </div>
      <div class="status-msg" id="resolveError"></div>
    </div>

    <!-- ── STEP 2.5: AI Refine (optional) ── -->
    <div class="step-panel" id="step-25">
      <div class="panel-title">Refine with AI <span style="font-size:11px; color:var(--muted); font-weight:400;">(optional)</span></div>
      <div class="panel-subtitle">Describe any adjustments — or skip this step to proceed to Preview.</div>

      <div class="refine-section">
        <label for="refineInstructions">What would you like to adjust?</label>
        <textarea id="refineInstructions" placeholder="e.g. Make it more concise and focus on TypeScript-specific concerns..."></textarea>
      </div>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button class="btn btn-primary" id="refineBtn" onclick="refinePrompt()">
          <span class="spinner" id="refineSpinner"></span>
          <span id="refineBtnText">Refine Prompt</span>
        </button>
      </div>
      <div class="refine-result" id="refineResult">
        <div class="live-preview-label" style="margin-top: 12px;">Refined Version</div>
        <div class="live-preview-box" id="refinedPreview"></div>
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="acceptRefined()">Accept Refined Version</button>
          <button class="btn btn-ghost" onclick="rejectRefined()">Keep Original</button>
        </div>
      </div>
      <div class="status-msg" id="refineError"></div>
    </div>

    <!-- ── STEP 3: Preview & Submit ── -->
    <div class="step-panel" id="step-3">
      <div class="panel-title">Preview &amp; Submit</div>
      <div class="panel-subtitle">Your resolved prompt is ready. Choose how to use it.</div>

      <div class="meta-row" id="previewMeta"></div>
      <div class="preview-box" id="previewContent"></div>

      <div class="action-grid">
        <button class="btn-action-primary" onclick="copyToChat()">
          Copy to Cursor Chat &mdash; paste with Cmd+V / Ctrl+V
        </button>
        <button class="btn-action-secondary" onclick="insertInEditor()">
          Insert at Cursor Position in Editor
        </button>
        <button class="btn-action-secondary" onclick="saveAsTemplate()">
          Save as Team Template
        </button>
      </div>
    </div>
  </div>

  <!-- Navigation Footer -->
  <div class="wizard-footer">
    <button class="btn btn-secondary" id="btnBack" onclick="goBack()" style="visibility:hidden">Back</button>
    <div id="footerMeta" style="font-size:11px; color:var(--muted);"></div>
    <button class="btn btn-primary" id="btnNext" onclick="goNext()" disabled>Next</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ── State ────────────────────────────────────────────────────────────────
    let currentStep = 1; // 1, 2, 25, 3
    const STEPS = [1, 2, 25, 3];

    let allPrompts = [];        // PromptSummary[]
    let selectedPrompt = null;  // PromptSummary
    let selectedTemplate = null; // PromptTemplate (full, with content + variables)
    let resolvedContent = '';   // final resolved content
    let isGeneratedMode = false; // true when user is using "Generate New" tab

    // ── Step Navigation ──────────────────────────────────────────────────────
    function stepIndex(step) { return STEPS.indexOf(step); }
    function stepLabel(step) {
      if (step === 1) return 'Step 1 of 3';
      if (step === 2) return 'Step 2 of 3';
      if (step === 25) return 'Refine (optional)';
      return 'Step 3 of 3';
    }

    function showStep(step) {
      STEPS.forEach(s => {
        const panel = document.getElementById('step-' + s);
        if (panel) panel.classList.toggle('active', s === step);
      });
      currentStep = step;

      // Update step indicator pills
      const stepMap = { 1: '1', 2: '2', 25: '25', 3: '3' };
      STEPS.forEach(s => {
        const pill = document.getElementById('pill-' + s);
        if (!pill) return;
        const idx = stepIndex(s);
        const curIdx = stepIndex(step);
        pill.className = 'step-pill' + (s === step ? ' active' : '') + (idx < curIdx ? ' done' : '');
        const dot = pill.querySelector('.step-dot');
        if (dot) dot.textContent = idx < curIdx ? '✓' : (s === 25 ? '~' : String(s === 25 ? 2.5 : s));
      });

      // Update footer
      const btnBack = document.getElementById('btnBack');
      const btnNext = document.getElementById('btnNext');
      const footerMeta = document.getElementById('footerMeta');
      footerMeta.textContent = stepLabel(step);

      btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';

      if (step === 3) {
        btnNext.style.display = 'none';
      } else if (step === 25) {
        btnNext.style.display = 'inline-flex';
        btnNext.textContent = 'Skip to Preview';
        btnNext.disabled = false;
      } else {
        btnNext.style.display = 'inline-flex';
        btnNext.textContent = step === 2 ? 'Refine (optional)' : 'Next';
        updateNextBtn();
      }
    }

    function updateNextBtn() {
      const btnNext = document.getElementById('btnNext');
      if (currentStep === 1) {
        if (isGeneratedMode) {
          const content = document.getElementById('generatedContent').value.trim();
          btnNext.disabled = !content;
        } else {
          btnNext.disabled = !selectedPrompt;
        }
      } else if (currentStep === 2) {
        btnNext.disabled = false; // Always can proceed (refine is optional)
      }
    }

    function goNext() {
      if (currentStep === 1) {
        if (isGeneratedMode) {
          // Build a synthetic template from generated content
          const content = document.getElementById('generatedContent').value.trim();
          const name = document.getElementById('generatedName').value.trim() || 'Generated Prompt';
          selectedTemplate = { slug: '', name, category: 'generated', tags: [], label: 'draft', version: 1, content, variables: {} };
          resolvedContent = content;
          buildStep3();
          showStep(3);
        } else {
          // Load full template then go to step 2
          loadTemplateAndGoToStep2();
        }
      } else if (currentStep === 2) {
        // Resolve variables and move to refine step
        resolveAndShowPreview();
        showStep(25);
      } else if (currentStep === 25) {
        buildStep3();
        showStep(3);
      }
    }

    function goBack() {
      if (currentStep === 2) showStep(1);
      else if (currentStep === 25) showStep(2);
      else if (currentStep === 3) showStep(25);
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    function switchTab(tab) {
      const tabs = document.querySelectorAll('.tab-btn');
      const panes = document.querySelectorAll('.tab-pane');
      tabs.forEach((t, i) => t.classList.toggle('active', ['browse','generate'][i] === tab));
      document.getElementById('tab-browse').classList.toggle('active', tab === 'browse');
      document.getElementById('tab-generate').classList.toggle('active', tab === 'generate');
      isGeneratedMode = tab === 'generate';
      updateNextBtn();
    }

    // ── Step 1: Browse Prompts ────────────────────────────────────────────────
    function filterPrompts(query) {
      const q = query.toLowerCase();
      renderPromptList(q ? allPrompts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      ) : allPrompts);
    }

    function renderPromptList(prompts) {
      const list = document.getElementById('promptList');
      const empty = document.getElementById('promptListEmpty');
      if (prompts.length === 0) {
        list.innerHTML = '<div class="prompt-list-empty">No prompts found.</div>';
        return;
      }
      if (empty) empty.remove();
      list.innerHTML = prompts.map(p => {
        const sel = selectedPrompt && selectedPrompt.slug === p.slug ? ' selected' : '';
        const tags = (p.tags || []).slice(0, 3).map(t => '<span class="badge" style="font-size:10px; margin-left:4px;">' + escHtml(t) + '</span>').join('');
        return '<div class="prompt-item' + sel + '" data-slug="' + escAttr(p.slug) + '" onclick="selectPrompt(this, ' + JSON.stringify(JSON.stringify(p)) + ')">' +
          '<div class="prompt-item-top"><span class="prompt-item-name">' + escHtml(p.name) + '</span>' +
          '<span class="badge">' + escHtml(p.category || 'general') + '</span>' + tags + '</div>' +
          '<div class="prompt-item-desc">' + escHtml(p.slug || '') + '</div>' +
          '</div>';
      }).join('');
    }

    function selectPrompt(el, pJson) {
      const p = JSON.parse(pJson);
      selectedPrompt = p;
      document.querySelectorAll('.prompt-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      updateNextBtn();
    }

    function loadTemplateAndGoToStep2() {
      if (!selectedPrompt) return;
      vscode.postMessage({ type: 'getPrompt', slug: selectedPrompt.slug, label: selectedPrompt.label || 'production' });
    }

    // ── Step 1: Generate Prompt ───────────────────────────────────────────────
    function generatePrompt() {
      const desc = document.getElementById('generateDesc').value.trim();
      if (!desc) return;
      setGenerating(true);
      showStatus('generateError', '', '');
      vscode.postMessage({ type: 'generatePrompt', description: desc });
    }

    function setGenerating(loading) {
      const btn = document.getElementById('generateBtn');
      const spinner = document.getElementById('generateSpinner');
      const text = document.getElementById('generateBtnText');
      btn.classList.toggle('loading', loading);
      spinner.style.display = loading ? 'inline-block' : 'none';
      text.textContent = loading ? 'Generating...' : 'Generate Prompt';
      btn.disabled = loading;
    }

    // ── Step 2: Build Variables Form ──────────────────────────────────────────
    function buildVariableForm(template) {
      const form = document.getElementById('varForm');
      document.getElementById('step2Title').textContent = 'Fill in Variables — ' + escHtml(template.name);
      document.getElementById('step2Subtitle').textContent = template.content
        ? template.content.substring(0, 80) + (template.content.length > 80 ? '...' : '')
        : 'Customize the prompt by filling in the required fields.';

      const vars = template.variables || {};
      const keys = Object.keys(vars);

      if (keys.length === 0) {
        form.innerHTML = '<div class="no-vars">This prompt has no variables — it\'s ready to use as-is.</div>';
        updateLivePreview();
        return;
      }

      form.innerHTML = keys.map(key => {
        const v = vars[key];
        const req = v.required ? '<span class="required">*</span>' : '';
        const defaultVal = v.default || '';
        let input = '';
        if (v.type === 'enum' && v.options) {
          const opts = v.options.map(o => '<option value="' + escAttr(o) + '">' + escHtml(o) + '</option>').join('');
          input = '<select id="var-' + escAttr(key) + '" onchange="updateLivePreview()">' + opts + '</select>';
        } else {
          input = '<input type="text" id="var-' + escAttr(key) + '" placeholder="' + escAttr(defaultVal || v.description || key) + '" value="' + escAttr(defaultVal) + '" oninput="updateLivePreview()" />';
        }
        const help = v.description ? '<div class="var-help">' + escHtml(v.description) + (defaultVal ? ' Default: <code>' + escHtml(defaultVal) + '</code>' : '') + '</div>' : '';
        return '<div class="var-field"><label for="var-' + escAttr(key) + '">' + escHtml(key) + req + '</label>' + input + help + '</div>';
      }).join('');

      updateLivePreview();
    }

    function gatherVariables() {
      const vars = selectedTemplate && selectedTemplate.variables ? selectedTemplate.variables : {};
      const result = {};
      Object.keys(vars).forEach(key => {
        const el = document.getElementById('var-' + key);
        if (el) result[key] = el.value || vars[key].default || '';
      });
      return result;
    }

    function updateLivePreview() {
      if (!selectedTemplate) return;
      const vars = gatherVariables();
      let preview = selectedTemplate.content || '';
      Object.entries(vars).forEach(([k, v]) => {
        preview = preview.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v || ('{{' + k + '}}'));
      });
      document.getElementById('livePreview').textContent = preview;
    }

    function resolveAndShowPreview() {
      const vars = gatherVariables();
      let content = selectedTemplate && selectedTemplate.content ? selectedTemplate.content : '';
      Object.entries(vars).forEach(([k, v]) => {
        content = content.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v || ('{{' + k + '}}'));
      });
      resolvedContent = content;
      document.getElementById('refinedPreview').textContent = content;
    }

    // ── Step 2.5: Refine ──────────────────────────────────────────────────────
    function refinePrompt() {
      const instructions = document.getElementById('refineInstructions').value.trim();
      if (!instructions) {
        showStatus('refineError', 'error', 'Enter adjustment instructions first.');
        return;
      }
      setRefining(true);
      showStatus('refineError', '', '');
      vscode.postMessage({ type: 'refinePrompt', prompt: resolvedContent, instructions });
    }

    function setRefining(loading) {
      const btn = document.getElementById('refineBtn');
      const spinner = document.getElementById('refineSpinner');
      const text = document.getElementById('refineBtnText');
      btn.classList.toggle('loading', loading);
      spinner.style.display = loading ? 'inline-block' : 'none';
      text.textContent = loading ? 'Refining...' : 'Refine Prompt';
      btn.disabled = loading;
    }

    function acceptRefined() {
      const refined = document.getElementById('refinedPreview').textContent;
      if (refined) resolvedContent = refined;
      buildStep3();
      showStep(3);
    }

    function rejectRefined() {
      buildStep3();
      showStep(3);
    }

    // ── Step 3: Preview ───────────────────────────────────────────────────────
    function buildStep3() {
      document.getElementById('previewContent').textContent = resolvedContent;
      const chars = resolvedContent.length;
      const tokens = Math.round(chars / 4);
      const name = selectedTemplate ? selectedTemplate.name : 'Prompt';
      document.getElementById('previewMeta').textContent = name + ' — ' + chars + ' chars (~' + tokens + ' tokens)';
    }

    function copyToChat() {
      vscode.postMessage({ type: 'copyToChat', content: resolvedContent });
    }

    function insertInEditor() {
      vscode.postMessage({ type: 'insertInEditor', content: resolvedContent });
    }

    function saveAsTemplate() {
      const name = selectedTemplate ? selectedTemplate.name : 'My Prompt';
      const vars = selectedTemplate ? (selectedTemplate.variables || {}) : {};
      const category = selectedTemplate ? (selectedTemplate.category || 'general') : 'general';
      const tags = selectedTemplate ? (selectedTemplate.tags || []) : [];
      vscode.postMessage({ type: 'saveAsTemplate', name, content: resolvedContent, variables: vars, category, tags });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function showStatus(id, type, msg) {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'status-msg' + (type ? ' show ' + type : '');
      el.textContent = msg;
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function escHtml(s) {
      if (!s) return '';
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escAttr(s) {
      if (!s) return '';
      return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ── Extension Message Handler ─────────────────────────────────────────────
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'promptsLoaded': {
          allPrompts = msg.prompts || [];
          if (allPrompts.length === 0) {
            document.getElementById('promptList').innerHTML = '<div class="prompt-list-empty">No prompts available on this platform.</div>';
          } else {
            renderPromptList(allPrompts);
          }
          break;
        }
        case 'promptsError': {
          document.getElementById('promptList').innerHTML = '<div class="prompt-list-empty" style="color:var(--error)">Failed to load prompts: ' + escHtml(msg.error) + '</div>';
          break;
        }
        case 'templateLoaded': {
          selectedTemplate = msg.template;
          buildVariableForm(selectedTemplate);
          showStep(2);
          break;
        }
        case 'templateError': {
          showStatus('browseError', 'error', 'Failed to load prompt: ' + (msg.error || 'Unknown error'));
          break;
        }
        case 'generateDone': {
          setGenerating(false);
          document.getElementById('generatedContent').value = msg.content || '';
          document.getElementById('generateResult').classList.add('show');
          // Build synthetic template for downstream steps
          const name = document.getElementById('generatedName').value.trim() || 'Generated Prompt';
          selectedTemplate = { slug: '', name, category: 'generated', tags: [], label: 'draft', version: 1, content: msg.content || '', variables: {} };
          resolvedContent = msg.content || '';
          updateNextBtn();
          break;
        }
        case 'generateError': {
          setGenerating(false);
          showStatus('generateError', 'error', msg.error || 'Failed to generate prompt.');
          break;
        }
        case 'refineDone': {
          setRefining(false);
          document.getElementById('refinedPreview').textContent = msg.content || '';
          document.getElementById('refineResult').classList.add('show');
          break;
        }
        case 'refineError': {
          setRefining(false);
          showStatus('refineError', 'error', msg.error || 'Failed to refine prompt.');
          break;
        }
        case 'copied': {
          showToast('Prompt copied! Paste into Cursor chat with Cmd+V / Ctrl+V');
          break;
        }
        case 'inserted': {
          showToast('Prompt inserted into editor.');
          break;
        }
        case 'saved': {
          showToast('Template saved to platform.');
          break;
        }
        case 'saveError': {
          showToast('Failed to save: ' + (msg.error || 'Unknown error'));
          break;
        }
      }
    });

    // ── Init ──────────────────────────────────────────────────────────────────
    showStep(1);
    vscode.postMessage({ type: 'fetchPrompts' });
  </script>
</body>
</html>`;
}
