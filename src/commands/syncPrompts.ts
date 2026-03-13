import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { PromptsTreeProvider } from '../views/promptsTree';

// ---------------------------------------------------------------------------
// Sync Prompts Command
//
// Pulls prompt templates from the Airlancer platform and writes them to
// .cursor/prompts/ as markdown files with YAML frontmatter.
// ---------------------------------------------------------------------------

export async function syncPromptsCommand(
  ctx: AirlancerContext,
  provider: PromptsTreeProvider,
): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  ctx.outputChannel.appendLine('Syncing prompts from Airlancer...');

  try {
    const count = await ctx.promptsSync.sync();
    provider.refresh();
    ctx.outputChannel.appendLine(`Synced ${count} prompts.`);
    if (count > 0) {
      vscode.window.showInformationMessage(`Synced ${count} Airlancer prompts to .cursor/prompts/`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Prompts sync failed: ${msg}`);
    vscode.window.showErrorMessage(`Prompts sync failed: ${msg}`);
  }
}
