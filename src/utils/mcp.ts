import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// MCP Server Registrar — Cursor, Antigravity, and VS Code
//
// Registration priority:
//   1. Cursor API (vscode.cursor.mcp.registerServer) — programmatic
//   2. Antigravity config (~/.gemini/antigravity/mcp_config.json) — file-based
//   3. Cursor fallback (.cursor/mcp.json in workspace) — file-based
//
// For Antigravity, we write to the global MCP config since Antigravity
// reads that at startup. For Cursor, we write to the workspace-level
// .cursor/mcp.json as a fallback when the programmatic API isn't available.
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

type IdeType = 'cursor-api' | 'antigravity' | 'cursor-file' | 'vscode';

export class McpRegistrar {
  private registered = false;
  private registeredVia: IdeType | null = null;
  private output: vscode.OutputChannel;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  get isCursorAvailable(): boolean {
    return typeof (vscode as unknown as { cursor?: CursorApi }).cursor?.mcp?.registerServer === 'function';
  }

  /**
   * Detect which IDE we're running in.
   */
  private detectIde(): IdeType {
    // 1. Cursor programmatic API
    if (this.isCursorAvailable) {
      return 'cursor-api';
    }

    // 2. Antigravity detection: check appName and ~/.gemini directory
    const appName = vscode.env.appName?.toLowerCase() ?? '';
    const hasGeminiDir = fs.existsSync(path.join(os.homedir(), '.gemini'));

    if (appName.includes('antigravity') || (hasGeminiDir && !appName.includes('cursor'))) {
      return 'antigravity';
    }

    // 3. Cursor file fallback (appName includes "cursor" but no API)
    if (appName.includes('cursor')) {
      return 'cursor-file';
    }

    // 4. Standard VS Code — use .cursor/mcp.json as it's the most common format
    return 'vscode';
  }

  /**
   * Antigravity MCP config path.
   */
  private get antigravityConfigPath(): string {
    return path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
  }

  /**
   * Register the Airlancer MCP server with the detected IDE.
   */
  async register(serverUrl: string, apiKey: string): Promise<void> {
    const mcpUrl = `${serverUrl.replace(/\/+$/, '')}/mcp`;
    const ide = this.detectIde();
    this.output.appendLine(`Detected IDE: ${ide}`);

    switch (ide) {
      case 'cursor-api': {
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
        this.registeredVia = 'cursor-api';
        this.output.appendLine('MCP server registered via Cursor API.');
        break;
      }

      case 'antigravity': {
        this.output.appendLine('Registering MCP server for Antigravity...');
        await this.writeAntigravityConfig(mcpUrl, apiKey);
        this.registered = true;
        this.registeredVia = 'antigravity';
        break;
      }

      case 'cursor-file':
      case 'vscode':
      default: {
        this.output.appendLine(`Registering MCP server via .cursor/mcp.json (${ide})...`);
        await this.writeCursorMcpJson(mcpUrl, apiKey);
        this.registered = true;
        this.registeredVia = ide;
        break;
      }
    }
  }

  /**
   * Unregister the MCP server (cleanup on disconnect/deactivate).
   */
  async unregister(): Promise<void> {
    if (!this.registered) { return; }

    switch (this.registeredVia) {
      case 'cursor-api': {
        try {
          const cursor = (vscode as unknown as { cursor: CursorApi }).cursor;
          cursor.mcp.unregisterServer(SERVER_NAME);
          this.output.appendLine('MCP server unregistered via Cursor API.');
        } catch {
          // Best-effort cleanup.
        }
        break;
      }

      case 'antigravity': {
        await this.removeAntigravityEntry();
        break;
      }

      case 'cursor-file':
      case 'vscode':
      default: {
        await this.removeCursorMcpJsonEntry();
        break;
      }
    }

    this.registered = false;
    this.registeredVia = null;
  }

  // --- Antigravity Config ---

  private async writeAntigravityConfig(mcpUrl: string, apiKey: string): Promise<void> {
    const configPath = this.antigravityConfigPath;
    const configDir = path.dirname(configPath);

    // Ensure directory exists.
    fs.mkdirSync(configDir, { recursive: true });

    // Read existing config.
    let config: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // File doesn't exist or invalid — start fresh.
    }

    const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
    servers['airlancer'] = {
      serverUrl: mcpUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    };
    config.mcpServers = servers;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    this.output.appendLine(`Wrote Antigravity MCP config: ${configPath}`);
    vscode.window.showInformationMessage('Airlancer MCP registered with Antigravity. Restart Antigravity to activate.');
  }

  private async removeAntigravityEntry(): Promise<void> {
    try {
      const configPath = this.antigravityConfigPath;
      if (!fs.existsSync(configPath)) { return; }

      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      const servers = config.mcpServers as Record<string, unknown> | undefined;
      if (servers && 'airlancer' in servers) {
        delete servers['airlancer'];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        this.output.appendLine('Removed airlancer from Antigravity MCP config.');
      }
    } catch {
      // Best-effort.
    }
  }

  // --- Cursor / VS Code File Fallback ---

  private async writeCursorMcpJson(mcpUrl: string, apiKey: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder open — cannot write .cursor/mcp.json');
      vscode.window.showWarningMessage(
        'Open a folder first, then run "Airlancer: Connect" to create the MCP config.'
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

  private async removeCursorMcpJsonEntry(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders?.length) { return; }

      const root = workspaceFolders[0].uri;
      const mcpJsonPath = vscode.Uri.joinPath(root, '.cursor', 'mcp.json');

      const content = await vscode.workspace.fs.readFile(mcpJsonPath);
      const existing = JSON.parse(Buffer.from(content).toString('utf-8'));
      const servers = existing.mcpServers as Record<string, unknown> | undefined;
      if (servers && 'airlancer' in servers) {
        delete servers['airlancer'];
        const newContent = JSON.stringify(existing, null, 2) + '\n';
        await vscode.workspace.fs.writeFile(mcpJsonPath, Buffer.from(newContent, 'utf-8'));
        this.output.appendLine('Removed airlancer entry from .cursor/mcp.json');
      }
    } catch {
      // File might not exist — that's fine.
    }
  }
}
