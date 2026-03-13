import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { ToolsTreeProvider } from '../views/tools';
import { DEFAULT_MCP_SERVER_URL } from '../generated/config';

// ---------------------------------------------------------------------------
// Connect / Disconnect Commands
// ---------------------------------------------------------------------------

export async function connectCommand(ctx: AirlancerContext, toolsProvider: ToolsTreeProvider): Promise<void> {
  const config = vscode.workspace.getConfiguration('airlancer');
  const serverUrl = (await ctx.secrets.getServerUrl()) ?? config.get<string>('serverUrl', DEFAULT_MCP_SERVER_URL);
  const apiKey = await ctx.secrets.getApiKey();

  if (!apiKey) {
    const action = await vscode.window.showWarningMessage(
      'No API key configured. Run the setup wizard to connect.',
      'Setup Wizard',
    );
    if (action === 'Setup Wizard') {
      vscode.commands.executeCommand('airlancer.setup');
    }
    return;
  }

  ctx.statusBar.setConnecting();
  ctx.outputChannel.appendLine(`Connecting to ${serverUrl}...`);

  try {
    // Configure client.
    ctx.client.configure(serverUrl, apiKey);

    // Test connection via MCP initialize.
    const status = await ctx.client.initialize();
    if (!status.connected) {
      throw new Error(status.error ?? 'Connection failed');
    }

    // Discover tools.
    const tools = await ctx.client.listTools();
    ctx.outputChannel.appendLine(`Connected! Server v${status.serverVersion}, ${tools.length} tools available.`);

    // Register MCP server with Cursor.
    await ctx.mcpRegistrar.register(serverUrl, apiKey);

    // Update state.
    ctx.connected = true;
    vscode.commands.executeCommand('setContext', 'airlancer.connected', true);
    ctx.statusBar.setConnected(tools.length);

    // Update sidebar tree views.
    toolsProvider.setTools(tools);
    ctx.statusTree.setConnected(serverUrl, status.serverVersion, tools.length);

    // Fetch team IDE config for role-aware setup.
    try {
      const ideConfig = await ctx.client.fetchIDEConfig();
      ctx.statusTree.setTeamInfo(ideConfig.role, ideConfig.scopes);
      ctx.outputChannel.appendLine(`Team config: role=${ideConfig.role}, scopes=${ideConfig.scopes.join(',')}`);
    } catch (err) {
      // Non-fatal — team config is informational.
      ctx.outputChannel.appendLine(`Team config fetch skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Auto-sync skills and rules.
    if (config.get<boolean>('syncSkillsOnConnect', true)) {
      vscode.commands.executeCommand('airlancer.syncSkills');
    }
    if (config.get<boolean>('syncRulesOnConnect', true)) {
      vscode.commands.executeCommand('airlancer.syncRules');
    }

    vscode.window.showInformationMessage(
      `Connected to Airlancer — ${tools.length} MCP tools available in Cursor.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Connection failed: ${msg}`);
    ctx.statusBar.setError(msg);
    ctx.statusTree.setDisconnected();
    ctx.connected = false;
    vscode.commands.executeCommand('setContext', 'airlancer.connected', false);
    vscode.window.showErrorMessage(`Failed to connect to Airlancer: ${msg}`);
  }
}

export async function disconnectCommand(ctx: AirlancerContext): Promise<void> {
  ctx.mcpRegistrar.unregister();
  ctx.connected = false;
  vscode.commands.executeCommand('setContext', 'airlancer.connected', false);
  ctx.statusBar.setDisconnected();
  ctx.statusTree.setDisconnected();
  ctx.outputChannel.appendLine('Disconnected from Airlancer.');
  vscode.window.showInformationMessage('Disconnected from Airlancer.');
}
