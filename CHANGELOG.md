# Changelog

## [0.3.0] - 2026-02-28

### Added
- **Google Antigravity support**: auto-detect and write `~/.gemini/antigravity/mcp_config.json`
- Multi-IDE MCP registrar: Cursor API → Antigravity config → Cursor file → VS Code fallback
- Setup scripts: `scripts/setup-antigravity.sh`, `scripts/setup-cursor.sh`
- Publish script: `scripts/publish.sh` for manual marketplace publishing
- GitHub Actions CI/CD push to VS Code Marketplace + Open VSX

### Changed
- Extension display name updated to "Airlancer — AI Governance for Cursor & Antigravity"
- README expanded with native MCP setup docs for Antigravity
- Package size reduced from 2.49MB to 1.26MB (excluded dead resources/)
- Repository URL updated to actual GitHub remote

## [0.2.0] - 2026-02-28

### Fixed
- Replace broken webview view with StatusTreeProvider for connection sidebar
- Fix status bar command not resetting on connect
- Replace oversized PNG activity bar icon with 24x24 SVG
- Fix JSON-RPC ID collision (use incrementing counter instead of Date.now())
- Add MCP `initialized` notification after protocol handshake (spec compliance)
- Fix statusbar `setError()` to explicitly set command property
- Fix `unregister()` to clean up `.cursor/mcp.json` entry in fallback mode
- Add Content-Security-Policy header and HTML escaping to setup webview
- Fix webview connect race condition (wait for save confirmation)
- Fix deactivation to handle already-disposed output channel

### Added
- `StatusTreeProvider` for connection status sidebar with actions
- `mcpNotify()` method for fire-and-forget protocol notifications
- SVG rocket icon for activity bar

## [0.1.0] - 2026-02-28

### Added
- Initial release
- MCP server auto-configuration via Cursor API or `.cursor/mcp.json` fallback
- Setup wizard with branded UI and connection testing
- API key management (create, store in OS keychain, revoke)
- Skills sync from Airlancer platform to `.cursor/skills/`
- Rules sync from Airlancer platform to `.cursor/rules/`
- Activity bar with connection status, tools, skills, and rules views
- Status bar integration showing connection state and tool count
- Periodic auto-sync for skills and rules
- 15 MCP tools: knowledge, agents, rules, workflows, stories, data rooms, cost tracking
- Per-tenant rate limiting and budget enforcement via the platform
