#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Manual publish script for Airlancer extension
#
# Usage:
#   ./scripts/publish.sh                 # Package only (dry run)
#   ./scripts/publish.sh --marketplace   # Publish to VS Code Marketplace
#   ./scripts/publish.sh --openvsx       # Publish to Open VSX
#   ./scripts/publish.sh --all           # Publish to both
#
# Prerequisites:
#   VS Code Marketplace: VSCE_PAT env var (Azure DevOps PAT with Marketplace scope)
#   Open VSX:            OVSX_PAT env var (token from open-vsx.org)
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Compiling TypeScript ==="
npm run compile

echo "=== Packaging extension ==="
npx @vscode/vsce package
VSIX=$(ls -t *.vsix | head -1)
echo "Package: $VSIX"

case "${1:-}" in
  --marketplace)
    if [ -z "${VSCE_PAT:-}" ]; then
      echo "ERROR: VSCE_PAT env var not set"
      echo "  Get one at: https://dev.azure.com → User Settings → Personal Access Tokens"
      echo "  Scope: Marketplace (Manage)"
      exit 1
    fi
    echo "=== Publishing to VS Code Marketplace ==="
    npx @vscode/vsce publish --packagePath "$VSIX" -p "$VSCE_PAT"
    echo "✅ Published to VS Code Marketplace"
    ;;
  --openvsx)
    if [ -z "${OVSX_PAT:-}" ]; then
      echo "ERROR: OVSX_PAT env var not set"
      echo "  Get one at: https://open-vsx.org → Account → Access Tokens"
      exit 1
    fi
    echo "=== Publishing to Open VSX ==="
    npx ovsx publish "$VSIX" -p "$OVSX_PAT"
    echo "✅ Published to Open VSX"
    ;;
  --all)
    if [ -z "${VSCE_PAT:-}" ] || [ -z "${OVSX_PAT:-}" ]; then
      echo "ERROR: Both VSCE_PAT and OVSX_PAT env vars required"
      exit 1
    fi
    echo "=== Publishing to VS Code Marketplace ==="
    npx @vscode/vsce publish --packagePath "$VSIX" -p "$VSCE_PAT"
    echo "✅ Published to VS Code Marketplace"

    echo "=== Publishing to Open VSX ==="
    npx ovsx publish "$VSIX" -p "$OVSX_PAT"
    echo "✅ Published to Open VSX"
    ;;
  *)
    echo ""
    echo "📦 Package ready: $VSIX"
    echo ""
    echo "To publish, run with:"
    echo "  VSCE_PAT=xxx ./scripts/publish.sh --marketplace"
    echo "  OVSX_PAT=xxx ./scripts/publish.sh --openvsx"
    echo "  VSCE_PAT=xxx OVSX_PAT=xxx ./scripts/publish.sh --all"
    ;;
esac
