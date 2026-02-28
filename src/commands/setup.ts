import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { AirlancerContext } from '../extension';
import { getSetupWizardHtml } from '../webview/setupWizard';

// ---------------------------------------------------------------------------
// Setup Wizard Command
//
// Opens a webview panel with a step-by-step setup flow:
//   1. Enter server URL (or use default)
//   2. Enter API key (or create one via dashboard link)
//   3. Test connection
//   4. Auto-configure Cursor MCP
//   5. Guided cursor.com settings (manual steps with links)
// ---------------------------------------------------------------------------

export async function setupWizardCommand(
  extensionContext: vscode.ExtensionContext,
  ctx: AirlancerContext,
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'airlancerSetup',
    'Airlancer Setup',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionContext.extensionUri, 'media'),
      ],
    },
  );

  const logoUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(extensionContext.extensionUri, 'media', 'icon.png'),
  );

  const config = vscode.workspace.getConfiguration('airlancer');
  const currentServerUrl = (await ctx.secrets.getServerUrl()) ?? config.get<string>('serverUrl', 'https://mcp-dev.airlancer.ai');
  const currentApiKey = (await ctx.secrets.getApiKey()) ?? '';
  const dashboardUrl = config.get<string>('dashboardUrl', 'https://adlc-dev.airlancer.ai');
  const nonce = crypto.randomBytes(16).toString('hex');

  panel.webview.html = getSetupWizardHtml(
    logoUri.toString(),
    currentServerUrl,
    currentApiKey ? '••••••••' : '',
    dashboardUrl,
    nonce,
  );

  // Handle messages from the webview.
  panel.webview.onDidReceiveMessage(async (message: { type: string; [key: string]: unknown }) => {
    switch (message.type) {
      case 'save': {
        const serverUrl = message.serverUrl as string;
        const apiKey = message.apiKey as string;

        if (!apiKey || apiKey === '••••••••') {
          panel.webview.postMessage({ type: 'error', message: 'Please enter a valid API key.' });
          return;
        }

        await ctx.secrets.setServerUrl(serverUrl);
        await ctx.secrets.setApiKey(apiKey);
        await vscode.workspace.getConfiguration('airlancer').update('serverUrl', serverUrl, true);

        panel.webview.postMessage({ type: 'saved' });
        ctx.outputChannel.appendLine(`Configuration saved. Server: ${serverUrl}`);
        break;
      }

      case 'test': {
        const serverUrl = message.serverUrl as string;
        const apiKey = message.apiKey as string;

        if (!apiKey || apiKey === '••••••••') {
          panel.webview.postMessage({ type: 'testResult', success: false, error: 'Enter an API key first.' });
          return;
        }

        panel.webview.postMessage({ type: 'testing' });

        try {
          ctx.client.configure(serverUrl, apiKey);
          const status = await ctx.client.initialize();
          if (status.connected) {
            const tools = await ctx.client.listTools();
            panel.webview.postMessage({
              type: 'testResult',
              success: true,
              version: status.serverVersion,
              toolCount: tools.length,
              tools: tools.map(t => t.name),
            });
          } else {
            panel.webview.postMessage({ type: 'testResult', success: false, error: status.error });
          }
        } catch (err) {
          panel.webview.postMessage({
            type: 'testResult',
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      case 'connect': {
        panel.dispose();
        vscode.commands.executeCommand('airlancer.connect');
        break;
      }

      case 'openDashboard': {
        const url = message.url as string ?? dashboardUrl;
        vscode.env.openExternal(vscode.Uri.parse(url));
        break;
      }

      case 'openCursorSettings': {
        vscode.env.openExternal(vscode.Uri.parse('https://cursor.com/settings'));
        break;
      }
    }
  });
}
