# Airlancer for Cursor & Antigravity

<p align="center">
  <img src="media/icon.png" width="120" alt="Airlancer" />
</p>

<p align="center">
  <strong>Connect your AI IDE to the Airlancer governance platform.</strong><br/>
  MCP tools · Skills sync · Policy rules · Cost tracking · Data rooms
</p>

<p align="center">
  Works with <strong>Cursor</strong> · <strong>Google Antigravity</strong> · <strong>VS Code</strong>
</p>

---

## Features

### 🔌 One-Click MCP Setup
Connect Cursor to Airlancer's MCP server with a guided setup wizard. Your API key is stored securely in the OS keychain — never in plaintext.

### 🛠️ 15 MCP Tools
Once connected, Cursor gains access to Airlancer platform tools:

| Category | Tools | What They Do |
|----------|-------|-------------|
| **Knowledge** | `search`, `retrieve` | Search your team's knowledge hub, docs, and patterns |
| **Agents** | `delegate`, `list` | Delegate tasks to specialized AI agents (security, testing, review) |
| **Rules** | `check`, `list` | Evaluate quality gates and policy rules |
| **Workflows** | `trigger`, `status` | Run and monitor SDLC pipelines |
| **Stories** | `list`, `get` | Access project stories and issues |
| **Data Rooms** | `list`, `query`, `schema` | Query governed data with column/row-level security |
| **Cost** | `status` | Check budget and spend |

### 📋 Skills Sync
Airlancer syncs team skills into `.cursor/skills/` — making your organization's expertise available to Cursor's AI.

### 📏 Rules Sync
Platform policies sync to `.cursor/rules/` as `.mdc` files — Cursor enforces your team's coding standards automatically.

### 💰 Cost Governance
Budget limits are enforced server-side. Expensive operations (agent delegation, workflow triggers) check daily/monthly budgets before executing.

---

## Getting Started

### 1. Install the Extension
Search for **"Airlancer"** in the Extensions panel, or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=airlancer.airlancer).

### 2. Run the Setup Wizard
Open the command palette (`Cmd+Shift+P`) and run:
```
Airlancer: Setup Wizard
```

### 3. Enter Your API Key
Get your API key from the [Airlancer Dashboard](https://adlc-dev.airlancer.ai) → Settings → API Keys.

### 4. You're Connected
The status bar shows your connection state. All 15 MCP tools are now available to Cursor.

---

## Commands

| Command | Description |
|---------|-------------|
| `Airlancer: Setup Wizard` | Guided connection setup |
| `Airlancer: Connect` | Connect with stored credentials |
| `Airlancer: Disconnect` | Disconnect from Airlancer |
| `Airlancer: Sync Skills` | Pull latest skills from platform |
| `Airlancer: Sync Rules` | Pull latest rules from platform |
| `Airlancer: Create API Key` | Generate a new API key |
| `Airlancer: Show Status` | View connection and budget status |
| `Airlancer: Open Dashboard` | Open Airlancer in browser |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `airlancer.serverUrl` | `https://mcp-dev.airlancer.ai` | MCP server URL |
| `airlancer.autoConnect` | `true` | Auto-connect on startup |
| `airlancer.syncSkillsOnConnect` | `true` | Auto-sync skills on connect |
| `airlancer.syncRulesOnConnect` | `true` | Auto-sync rules on connect |
| `airlancer.skillsSyncInterval` | `300` | Skills sync interval (seconds) |
| `airlancer.rulesSyncInterval` | `300` | Rules sync interval (seconds) |
| `airlancer.dashboardUrl` | `https://adlc-dev.airlancer.ai` | Dashboard URL |

## Security

- **API keys** are stored in the OS keychain via VS Code's SecretStorage API
- **All traffic** flows through HTTPS with Bearer token authentication
- **RBAC enforcement** — tool access is controlled by your Airlancer role
- **Scope restrictions** — API keys can be limited to specific tool categories
- **Audit trail** — every tool call is logged for compliance

## Antigravity / Native MCP Setup

If you're using **Google Antigravity** or any MCP-compatible IDE, you can connect directly without this extension:

Add to your MCP config (`~/.gemini/antigravity/mcp_config.json` for Antigravity, `.cursor/mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "airlancer": {
      "serverUrl": "https://mcp-dev.airlancer.ai/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Get your API key from the [Airlancer Dashboard](https://adlc-dev.airlancer.ai) → Settings → API Keys.

> **Note**: The extension adds auto-connect, skills/rules sync, sidebar views, and a setup wizard on top of the raw MCP connection.

## Requirements

- **Cursor** 0.44+ / **Google Antigravity** / **VS Code** 1.85+
- An **Airlancer** account with API access

## Development

### Build from Source

```bash
npm ci
npm run compile

# Package as .vsix
npx @vscode/vsce package --no-dependencies

# Install locally (no marketplace needed)
cursor --install-extension airlancer-0.4.0.vsix --force
# Or: code --install-extension airlancer-0.4.0.vsix --force

# Quick rebuild loop
npm run compile && npx @vscode/vsce package --no-dependencies && cursor --install-extension airlancer-*.vsix --force
```

### Environment Builds

```bash
# Development (default)
AIRLANCER_ENV=dev npm run compile

# Production
AIRLANCER_ENV=prod npm run compile
```

### Publish

```bash
# VS Code Marketplace
npm run publish:vscode

# Open VSX Registry
npm run publish:openvsx

# Both
npm run publish:all
```

## Links

- [Airlancer Platform](https://airlancer.ai)
- [Documentation](https://docs.airlancer.ai)
- [Report Issues](https://github.com/airlancer/airlancer-cursor-extension/issues)
