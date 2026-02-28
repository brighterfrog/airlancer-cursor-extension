# Changelog

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
