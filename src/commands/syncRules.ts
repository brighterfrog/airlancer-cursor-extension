import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { RulesTreeProvider } from '../views/rulesTree';

// ---------------------------------------------------------------------------
// Sync Rules Command
//
// Pulls policy rules from the Airlancer platform and writes them to
// .cursor/rules/ as .mdc (MDX) files.
// ---------------------------------------------------------------------------

export async function syncRulesCommand(
  ctx: AirlancerContext,
  provider: RulesTreeProvider,
): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  ctx.outputChannel.appendLine('Syncing rules from Airlancer...');

  try {
    const count = await ctx.rulesSync.sync();
    provider.refresh();
    ctx.outputChannel.appendLine(`Synced ${count} rules.`);
    if (count > 0) {
      vscode.window.showInformationMessage(`Synced ${count} Airlancer rules to .cursor/rules/`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Rules sync failed: ${msg}`);
    vscode.window.showErrorMessage(`Rules sync failed: ${msg}`);
  }
}
