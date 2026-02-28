#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Airlancer × Google Antigravity — MCP Setup Script
#
# Configures Google Antigravity to connect to the Airlancer MCP server.
# Adds the airlancer server entry to Antigravity's MCP config.
#
# Usage:
#   ./scripts/setup-antigravity.sh                    # Interactive
#   ./scripts/setup-antigravity.sh --api-key KEY      # Non-interactive
#   ./scripts/setup-antigravity.sh --server-url URL   # Custom server
#   ./scripts/setup-antigravity.sh --remove            # Remove config
#
# Environment variables (alternative to flags):
#   AIRLANCER_API_KEY    — Your Airlancer API key
#   AIRLANCER_SERVER_URL — MCP server URL (default: https://mcp-dev.airlancer.ai)
# ---------------------------------------------------------------------------
set -euo pipefail

# Defaults
DEFAULT_SERVER_URL="https://mcp-dev.airlancer.ai"
CONFIG_DIR="${HOME}/.gemini/antigravity"
CONFIG_FILE="${CONFIG_DIR}/mcp_config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
API_KEY="${AIRLANCER_API_KEY:-}"
SERVER_URL="${AIRLANCER_SERVER_URL:-$DEFAULT_SERVER_URL}"
REMOVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)   API_KEY="$2"; shift 2 ;;
    --server-url) SERVER_URL="$2"; shift 2 ;;
    --remove)    REMOVE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--api-key KEY] [--server-url URL] [--remove]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo -e "${PURPLE}${BOLD}  ╔════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}${BOLD}  ║  🚀 Airlancer × Google Antigravity    ║${NC}"
echo -e "${PURPLE}${BOLD}  ║     MCP Integration Setup              ║${NC}"
echo -e "${PURPLE}${BOLD}  ╚════════════════════════════════════════╝${NC}"
echo ""

# Handle removal
if $REMOVE; then
  if [ -f "$CONFIG_FILE" ]; then
    # Remove airlancer entry using python3 (available on all platforms)
    python3 -c "
import json, sys
try:
    with open('$CONFIG_FILE') as f:
        config = json.load(f)
    servers = config.get('mcpServers', {})
    if 'airlancer' in servers:
        del servers['airlancer']
        with open('$CONFIG_FILE', 'w') as f:
            json.dump(config, f, indent=2)
            f.write('\n')
        print('Removed airlancer from MCP config.')
    else:
        print('No airlancer entry found in MCP config.')
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
"
  else
    echo "No Antigravity MCP config found at $CONFIG_FILE"
  fi
  echo -e "${GREEN}✅ Airlancer removed from Antigravity.${NC}"
  exit 0
fi

# Check if Antigravity config directory exists
if [ ! -d "${HOME}/.gemini" ]; then
  echo -e "${YELLOW}⚠  Antigravity config directory (~/.gemini) not found.${NC}"
  echo "   Make sure Google Antigravity is installed."
  echo "   Download from: https://antigravity.google/"
  echo ""
  read -rp "Create config directory anyway? (y/N): " CREATE_DIR
  if [[ "$CREATE_DIR" != [yY] ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Prompt for API key if not provided
if [ -z "$API_KEY" ]; then
  echo -e "${CYAN}Step 1: API Key${NC}"
  echo "  Get your API key from the Airlancer Dashboard:"
  echo "  → https://adlc-dev.airlancer.ai → Settings → API Keys"
  echo ""
  read -rsp "  Enter your Airlancer API key: " API_KEY
  echo ""
  echo ""
fi

# Validate API key format
if [[ ! "$API_KEY" =~ ^alr_live_ ]]; then
  echo -e "${RED}❌ Invalid API key format. Keys should start with 'alr_live_'.${NC}"
  exit 1
fi

echo -e "${CYAN}Step 2: Server URL${NC}"
echo -e "  Using: ${BOLD}${SERVER_URL}${NC}"
echo ""

# Test connection
echo -e "${CYAN}Step 3: Testing connection...${NC}"
TEST_RESULT=$(curl -s --max-time 10 -X POST "${SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"antigravity-setup","version":"1.0.0"}}}' 2>&1)

if echo "$TEST_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'result' in d" 2>/dev/null; then
  SERVER_VERSION=$(echo "$TEST_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['serverInfo']['version'])" 2>/dev/null || echo "unknown")
  echo -e "  ${GREEN}✅ Connected! Server v${SERVER_VERSION}${NC}"

  # Get tool count
  TOOLS_RESULT=$(curl -s --max-time 10 -X POST "${SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' 2>&1)
  TOOL_COUNT=$(echo "$TOOLS_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['tools']))" 2>/dev/null || echo "?")
  echo -e "  ${GREEN}   ${TOOL_COUNT} MCP tools available${NC}"
else
  echo -e "  ${RED}❌ Connection failed.${NC}"
  echo "  Response: ${TEST_RESULT:0:200}"
  echo ""
  read -rp "Continue anyway? (y/N): " CONTINUE
  if [[ "$CONTINUE" != [yY] ]]; then
    echo "Aborted."
    exit 1
  fi
fi
echo ""

# Write config
echo -e "${CYAN}Step 4: Writing Antigravity MCP config...${NC}"
mkdir -p "$CONFIG_DIR"

python3 -c "
import json, os, sys

config_file = '$CONFIG_FILE'
server_url = '$SERVER_URL'
api_key = '$API_KEY'

# Read existing config or start fresh
config = {}
if os.path.exists(config_file):
    try:
        with open(config_file) as f:
            config = json.load(f)
    except json.JSONDecodeError:
        print('  Warning: existing config was invalid JSON, starting fresh.')

servers = config.get('mcpServers', {})

# Add/update airlancer entry
servers['airlancer'] = {
    'serverUrl': f'{server_url}/mcp',
    'headers': {
        'Authorization': f'Bearer {api_key}'
    }
}

config['mcpServers'] = servers

with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')

print(f'  Wrote: {config_file}')
total = len(servers)
print(f'  Total MCP servers configured: {total}')
"

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Airlancer is now connected to Antigravity!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo "  What's available:"
echo "  • ${TOOL_COUNT:-15} MCP tools (knowledge, agents, rules, workflows, stories, data rooms, cost)"
echo "  • Budget-enforced AI governance"
echo "  • RBAC-controlled access per tool"
echo "  • Full audit trail of all tool calls"
echo ""
echo "  Next steps:"
echo "  1. Open Google Antigravity"
echo "  2. Start a new conversation and ask the agent to use Airlancer tools"
echo "  3. Example: \"Use the airlancer.stories.list tool to show my current stories\""
echo ""
echo "  Manage: https://adlc-dev.airlancer.ai"
echo "  Docs:   https://docs.airlancer.ai"
echo ""
