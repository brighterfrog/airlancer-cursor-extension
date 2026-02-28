import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { SkillsTreeProvider } from '../views/skillsTree';

// ---------------------------------------------------------------------------
// Sync Skills Command
//
// Pulls skills from the Airlancer platform and writes them to
// .cursor/skills/ as SKILL.md files with YAML frontmatter.
// ---------------------------------------------------------------------------

export async function syncSkillsCommand(
  ctx: AirlancerContext,
  provider: SkillsTreeProvider,
): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  ctx.outputChannel.appendLine('Syncing skills from Airlancer...');

  try {
    const count = await ctx.skillsSync.sync();
    provider.refresh();
    ctx.outputChannel.appendLine(`Synced ${count} skills.`);
    if (count > 0) {
      vscode.window.showInformationMessage(`Synced ${count} Airlancer skills to .cursor/skills/`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Skills sync failed: ${msg}`);
    vscode.window.showErrorMessage(`Skills sync failed: ${msg}`);
  }
}
