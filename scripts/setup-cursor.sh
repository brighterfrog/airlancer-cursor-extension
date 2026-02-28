#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Airlancer × Cursor — Native MCP Setup (no extension required)
#
# Writes .cursor/mcp.json to the current workspace for direct MCP access.
# Use this if you prefer native MCP without the extension's sidebar/sync.
#
# Usage:
#   ./scripts/setup-cursor.sh                    # Interactive
#   ./scripts/setup-cursor.sh --api-key KEY      # Non-interactive
#   ./scripts/setup-cursor.sh --global            # Write to ~/.cursor/mcp.json
#   ./scripts/setup-cursor.sh --remove            # Remove config
# ---------------------------------------------------------------------------
set -euo pipefail

DEFAULT_SERVER_URL="https://mcp-dev.airlancer.ai"
API_KEY="${AIRLANCER_API_KEY:-}"
SERVER_URL="${AIRLANCER_SERVER_URL:-$DEFAULT_SERVER_URL}"
GLOBAL=false
REMOVE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)    API_KEY="$2"; shift 2 ;;
    --server-url) SERVER_URL="$2"; shift 2 ;;
    --global)     GLOBAL=true; shift ;;
    --remove)     REMOVE=true; shift ;;
    --help|-h)    echo "Usage: $0 [--api-key KEY] [--server-url URL] [--global] [--remove]"; exit 0 ;;
    *)            echo "Unknown option: $1"; exit 1 ;;
  esac
done

if $GLOBAL; then
  CONFIG_DIR="${HOME}/.cursor"
else
  CONFIG_DIR=".cursor"
fi
CONFIG_FILE="${CONFIG_DIR}/mcp.json"

echo ""
echo -e "${PURPLE}${BOLD}  🚀 Airlancer × Cursor — Native MCP Setup${NC}"
echo ""

if $REMOVE; then
  if [ -f "$CONFIG_FILE" ]; then
    python3 -c "
import json
with open('$CONFIG_FILE') as f:
    config = json.load(f)
servers = config.get('mcpServers', {})
if 'airlancer' in servers:
    del servers['airlancer']
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(config, f, indent=2)
        f.write('\n')
    print('Removed airlancer from Cursor MCP config.')
else:
    print('No airlancer entry found.')
"
  fi
  echo -e "${GREEN}✅ Done.${NC}"
  exit 0
fi

if [ -z "$API_KEY" ]; then
  echo "  Get your API key from: https://adlc-dev.airlancer.ai → Settings → API Keys"
  echo ""
  read -rsp "  Enter your Airlancer API key: " API_KEY
  echo ""
fi

if [[ ! "$API_KEY" =~ ^alr_live_ ]]; then
  echo -e "${RED}❌ Invalid key format (should start with alr_live_)${NC}"
  exit 1
fi

# Test connection
echo -e "  Testing connection to ${SERVER_URL}..."
if curl -sf --max-time 10 -X POST "${SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cursor-setup","version":"1.0.0"}}}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert 'result' in d" 2>/dev/null; then
  echo -e "  ${GREEN}✅ Connected!${NC}"
else
  echo -e "  ${RED}⚠  Connection test failed — writing config anyway.${NC}"
fi

# Write config
mkdir -p "$CONFIG_DIR"
python3 -c "
import json, os
config = {}
if os.path.exists('$CONFIG_FILE'):
    try:
        with open('$CONFIG_FILE') as f:
            config = json.load(f)
    except: pass
servers = config.get('mcpServers', {})
servers['airlancer'] = {
    'url': '${SERVER_URL}/mcp',
    'type': 'streamableHttp',
    'headers': {'Authorization': 'Bearer ${API_KEY}'}
}
config['mcpServers'] = servers
with open('$CONFIG_FILE', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
print(f'  Wrote: $CONFIG_FILE')
"

echo ""
echo -e "${GREEN}${BOLD}  ✅ Airlancer MCP is configured for Cursor!${NC}"
echo "  Restart Cursor or reload the window to activate."
echo ""
