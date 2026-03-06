// ---------------------------------------------------------------------------
// Setup Wizard Webview HTML
//
// Branded setup flow with Airlancer logo. Steps:
// 1. Server URL + API Key entry
// 2. Test connection
// 3. Auto-configure Cursor
// 4. Guided cursor.com settings
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getSetupWizardHtml(
  logoUri: string,
  serverUrl: string,
  apiKeyMasked: string,
  dashboardUrl: string,
  nonce: string,
): string {
  const safeServerUrl = escapeHtml(serverUrl);
  const safeApiKey = escapeHtml(apiKeyMasked);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Airlancer Setup</title>
  <style>
    :root {
      --primary: #7c3aed;
      --primary-light: #a78bfa;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-input-border);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      color: var(--fg);
      background: var(--bg);
      padding: 0;
      line-height: 1.6;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }

    /* Header with logo */
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .logo { width: 80px; height: 80px; margin-bottom: 12px; border-radius: 16px; }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #a78bfa, #7c3aed, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header p { color: var(--vscode-descriptionForeground); font-size: 14px; margin-top: 4px; }

    /* Steps */
    .step { margin-bottom: 28px; }
    .step-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .step-number {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .step-number.done { background: var(--success); }
    .step-title { font-size: 16px; font-weight: 600; }

    /* Form */
    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--input-fg);
      font-size: 14px;
      font-family: var(--vscode-editor-font-family, monospace);
      margin-bottom: 12px;
    }
    input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: var(--button-bg); color: var(--button-fg); }
    .btn-secondary {
      background: transparent;
      color: var(--primary-light);
      border: 1px solid var(--border);
    }
    .btn-success { background: var(--success); color: white; }
    .btn-row { display: flex; gap: 8px; margin-top: 8px; }

    /* Status */
    .status {
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 13px;
      display: none;
    }
    .status.show { display: block; }
    .status.success { background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success); }
    .status.error { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); }
    .status.info { background: rgba(124, 58, 237, 0.1); border: 1px solid var(--primary); }

    /* Checklist */
    .checklist { list-style: none; padding: 0; }
    .checklist li {
      padding: 6px 0;
      font-size: 13px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .checklist li::before {
      content: "→";
      color: var(--primary-light);
      font-weight: bold;
      flex-shrink: 0;
    }
    .check-icon { color: var(--success); }

    /* Tools list */
    .tools-list {
      max-height: 200px;
      overflow-y: auto;
      margin-top: 8px;
      padding: 8px;
      background: var(--input-bg);
      border-radius: 6px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
    }
    .tools-list div { padding: 2px 0; }

    .link { color: var(--primary-light); text-decoration: none; cursor: pointer; }
    .link:hover { text-decoration: underline; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header with Airlancer Logo -->
    <div class="header">
      <img src="${logoUri}" alt="Airlancer" class="logo" />
      <h1>Airlancer for Cursor</h1>
      <p>Connect your IDE to the Airlancer governance platform</p>
    </div>

    <!-- Step 1: Server URL -->
    <div class="step">
      <div class="step-header">
        <div class="step-number" id="step1-num">1</div>
        <div class="step-title">Server URL</div>
      </div>
      <label for="serverUrl">MCP Server URL</label>
      <input type="text" id="serverUrl" value="${safeServerUrl}" placeholder="${safeServerUrl}" />
      <p class="muted">Your Airlancer MCP server endpoint. Default works for most setups.</p>
    </div>

    <!-- Step 2: API Key -->
    <div class="step">
      <div class="step-header">
        <div class="step-number" id="step2-num">2</div>
        <div class="step-title">API Key</div>
      </div>
      <label for="apiKey">Airlancer API Key</label>
      <input type="password" id="apiKey" value="${safeApiKey}" placeholder="alr_live_..." />
      <p class="muted">
        Create an API key with 'MCP' scope, then paste it below. Get it from the
        <a class="link" onclick="openDashboardApiKeys()">Airlancer Dashboard → Settings → API Keys</a>.
      </p>
    </div>

    <!-- Step 3: Test & Connect -->
    <div class="step">
      <div class="step-header">
        <div class="step-number" id="step3-num">3</div>
        <div class="step-title">Test Connection</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="testConnection()">🔌 Test Connection</button>
        <button class="btn btn-secondary" onclick="saveConfig()">💾 Save</button>
      </div>
      <div class="status" id="testStatus"></div>
      <div class="tools-list" id="toolsList" style="display:none"></div>
    </div>

    <!-- Step 4: Connect -->
    <div class="step" id="step4" style="display:none">
      <div class="step-header">
        <div class="step-number done">✓</div>
        <div class="step-title">Ready to Connect</div>
      </div>
      <p style="margin-bottom: 12px;">Connection verified. Click below to activate Airlancer in Cursor.</p>
      <button class="btn btn-success" onclick="connect()">🚀 Connect & Activate</button>
    </div>

    <!-- Step 5: Manual cursor.com settings -->
    <div class="step">
      <div class="step-header">
        <div class="step-number" id="step5-num">4</div>
        <div class="step-title">Cursor.com Settings (Optional)</div>
      </div>
      <p class="muted" style="margin-bottom: 8px;">
        These settings are managed on cursor.com and can't be auto-configured.
        Click to open each setting:
      </p>
      <ul class="checklist">
        <li>Set default model to <strong>claude-sonnet-4-5</strong> for best results</li>
        <li>Enable <strong>Long-running agents</strong> for complex workflows</li>
        <li>Add <strong>${safeServerUrl}</strong> to the network allowlist</li>
        <li>Enable <strong>Agent summaries visible to team</strong> for collaboration</li>
      </ul>
      <div class="btn-row" style="margin-top: 12px;">
        <button class="btn btn-secondary" onclick="openCursorSettings()">⚙️ Open cursor.com Settings</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function testConnection() {
      const serverUrl = document.getElementById('serverUrl').value;
      const apiKey = document.getElementById('apiKey').value;
      vscode.postMessage({ type: 'test', serverUrl, apiKey });
    }

    function saveConfig() {
      const serverUrl = document.getElementById('serverUrl').value;
      const apiKey = document.getElementById('apiKey').value;
      vscode.postMessage({ type: 'save', serverUrl, apiKey });
    }

    let pendingConnect = false;

    function connect() {
      const serverUrl = document.getElementById('serverUrl').value;
      const apiKey = document.getElementById('apiKey').value;
      pendingConnect = true;
      vscode.postMessage({ type: 'save', serverUrl, apiKey });
      // Connect will fire when we receive the 'saved' confirmation.
    }

    function openDashboard() {
      vscode.postMessage({ type: 'openDashboard', url: '${safeDashboardUrl}' });
    }

    function openDashboardApiKeys() {
      vscode.postMessage({ type: 'openDashboard', url: '${safeDashboardUrl}/settings/api-keys' });
    }

    function openCursorSettings() {
      vscode.postMessage({ type: 'openCursorSettings' });
    }

    // Handle messages from extension.
    window.addEventListener('message', (event) => {
      const msg = event.data;
      const status = document.getElementById('testStatus');
      const toolsList = document.getElementById('toolsList');
      const step4 = document.getElementById('step4');

      switch (msg.type) {
        case 'testing':
          status.className = 'status show info';
          status.textContent = 'Testing connection...';
          toolsList.style.display = 'none';
          break;

        case 'testResult':
          if (msg.success) {
            status.className = 'status show success';
            status.innerHTML = '✅ Connected! Server v' + msg.version + ' — ' + msg.toolCount + ' tools available.';
            document.getElementById('step3-num').className = 'step-number done';
            document.getElementById('step3-num').textContent = '✓';
            step4.style.display = 'block';

            if (msg.tools && msg.tools.length > 0) {
              toolsList.style.display = 'block';
              toolsList.innerHTML = msg.tools.map(t => '<div>🔧 ' + t + '</div>').join('');
            }
          } else {
            status.className = 'status show error';
            status.textContent = '❌ ' + (msg.error || 'Connection failed');
            step4.style.display = 'none';
          }
          break;

        case 'saved':
          if (pendingConnect) {
            pendingConnect = false;
            vscode.postMessage({ type: 'connect' });
          } else {
            status.className = 'status show success';
            status.textContent = '💾 Configuration saved.';
          }
          break;

        case 'error':
          status.className = 'status show error';
          status.textContent = '❌ ' + msg.message;
          break;
      }
    });
  </script>
</body>
</html>`;
}
