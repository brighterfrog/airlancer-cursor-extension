import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Cursor MCP Server Registrar
//
// Uses the Cursor-specific extension API (`vscode.cursor.mcp.registerServer`)
// to programmatically register the Airlancer MCP server. This means users
// don't need to manually edit .cursor/mcp.json.
//
// In standard VS Code (no Cursor API), falls back to writing .cursor/mcp.json.
// ---------------------------------------------------------------------------

const SERVER_NAME = 'airlancer-platform';

interface CursorApi {
  mcp: {
    registerServer(config: {
      name: string;
      server: { url: string; headers?: Record<string, string> };
    }): void;
    unregisterServer(name: string): void;
  };
}

export class McpRegistrar {
  private registered = false;
  private output: vscode.OutputChannel;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  get isCursorAvailable(): boolean {
    return typeof (vscode as unknown as { cursor?: CursorApi }).cursor?.mcp?.registerServer === 'function';
  }

  /**
   * Register the Airlancer MCP server with Cursor.
   * Falls back to .cursor/mcp.json if the Cursor API is unavailable.
   */
  async register(serverUrl: string, apiKey: string): Promise<void> {
    const mcpUrl = `${serverUrl.replace(/\/+$/, '')}/mcp`;

    if (this.isCursorAvailable) {
      this.output.appendLine('Registering MCP server via Cursor API...');
      const cursor = (vscode as unknown as { cursor: CursorApi }).cursor;
      cursor.mcp.registerServer({
        name: SERVER_NAME,
        server: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      });
      this.registered = true;
      this.output.appendLine('MCP server registered via Cursor API.');
    } else {
      this.output.appendLine('Cursor API not available — writing .cursor/mcp.json...');
      await this.writeMcpJson(mcpUrl, apiKey);
      this.registered = true;
    }
  }

  /**
   * Unregister the MCP server (cleanup on disconnect/deactivate).
   */
  unregister(): void {
    if (!this.registered) { return; }

    if (this.isCursorAvailable) {
      try {
        const cursor = (vscode as unknown as { cursor: CursorApi }).cursor;
        cursor.mcp.unregisterServer(SERVER_NAME);
        this.output.appendLine('MCP server unregistered via Cursor API.');
      } catch {
        // Best-effort cleanup.
      }
    }
    this.registered = false;
  }

  /**
   * Fallback: write .cursor/mcp.json to workspace root.
   */
  private async writeMcpJson(mcpUrl: string, apiKey: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder open — cannot write .cursor/mcp.json');
      vscode.window.showWarningMessage(
        'Open a folder in Cursor first, then run "Airlancer: Connect" to create the MCP config.'
      );
      return;
    }

    const root = workspaceFolders[0].uri;
    const cursorDir = vscode.Uri.joinPath(root, '.cursor');
    const mcpJsonPath = vscode.Uri.joinPath(cursorDir, 'mcp.json');

    // Read existing mcp.json if present.
    let existing: Record<string, unknown> = {};
    try {
      const content = await vscode.workspace.fs.readFile(mcpJsonPath);
      existing = JSON.parse(Buffer.from(content).toString('utf-8'));
    } catch {
      // File doesn't exist — start fresh.
    }

    const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
    servers['airlancer'] = {
      url: mcpUrl,
      type: 'streamableHttp',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    };

    const newContent = JSON.stringify({ ...existing, mcpServers: servers }, null, 2) + '\n';

    await vscode.workspace.fs.createDirectory(cursorDir);
    await vscode.workspace.fs.writeFile(mcpJsonPath, Buffer.from(newContent, 'utf-8'));
    this.output.appendLine(`Wrote ${mcpJsonPath.fsPath}`);
  }
}
