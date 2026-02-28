import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';

// ---------------------------------------------------------------------------
// Create API Key Command
//
// Quick-create an API key from within the IDE, without visiting the dashboard.
// ---------------------------------------------------------------------------

export async function createApiKeyCommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'API Key Name',
    placeHolder: 'e.g., My Cursor Key',
    validateInput: (v) => v.trim().length === 0 ? 'Name is required' : undefined,
  });

  if (!name) { return; }

  const expiry = await vscode.window.showQuickPick(
    [
      { label: '30 days', value: '30d' },
      { label: '90 days', value: '90d' },
      { label: '365 days', value: '365d' },
      { label: 'Never', value: '' },
    ],
    { placeHolder: 'API Key Expiry' },
  );

  if (!expiry) { return; }

  try {
    const result = await ctx.client.createApiKey(name, ['tools:*'], expiry.value);

    // Show the key to the user (this is the only time they'll see it).
    const action = await vscode.window.showInformationMessage(
      `API Key created: ${result.keyPrefix}...  Copy it now — it won't be shown again.`,
      'Copy to Clipboard',
      'Use as Current Key',
    );

    if (action === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(result.key);
      vscode.window.showInformationMessage('API key copied to clipboard.');
    } else if (action === 'Use as Current Key') {
      await ctx.secrets.setApiKey(result.key);
      vscode.window.showInformationMessage('API key saved. Reconnecting...');
      vscode.commands.executeCommand('airlancer.connect');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to create API key: ${msg}`);
  }
}
