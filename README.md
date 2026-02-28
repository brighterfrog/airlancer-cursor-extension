# Airlancer for Cursor

<p align="center">
  <img src="media/icon.png" width="120" alt="Airlancer" />
</p>

<p align="center">
  <strong>Connect Cursor to the Airlancer AI governance platform.</strong><br/>
  MCP tools · Skills sync · Policy rules · Cost tracking · Data rooms
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

## Requirements

- **Cursor** 0.44+ (or VS Code 1.85+)
- An **Airlancer** account with API access

## Links

- [Airlancer Platform](https://airlancer.ai)
- [Documentation](https://docs.airlancer.ai)
- [Report Issues](https://github.com/airlancer/airlancer-cursor-extension/issues)
