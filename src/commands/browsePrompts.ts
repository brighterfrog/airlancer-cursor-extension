import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { PromptSummary, PromptTemplate } from '../sync/prompts';

// ---------------------------------------------------------------------------
// Browse Prompts Command
//
// Lists all available prompt templates via MCP, shows a QuickPick, and
// opens the selected prompt content in a readonly markdown editor tab.
// ---------------------------------------------------------------------------

export async function browsePromptsCommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  ctx.outputChannel.appendLine('Fetching prompts list...');

  let summaries: PromptSummary[];
  try {
    const result = await ctx.client.callTool('airlancer.prompts.list', { label: 'production' });
    if (Array.isArray(result)) {
      summaries = result as PromptSummary[];
    } else if (result && typeof result === 'object' && 'prompts' in (result as Record<string, unknown>)) {
      summaries = (result as Record<string, unknown>).prompts as PromptSummary[];
    } else {
      summaries = [];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Failed to fetch prompts: ${msg}`);
    vscode.window.showErrorMessage(`Failed to fetch prompts: ${msg}`);
    return;
  }

  if (summaries.length === 0) {
    vscode.window.showInformationMessage('No prompts available on this platform.');
    return;
  }

  const items: (vscode.QuickPickItem & { slug: string; label2: string })[] = summaries.map(p => ({
    label: `$(file) ${p.name}`,
    description: p.category,
    detail: p.tags?.length ? `[${p.tags.join(', ')}]` : undefined,
    slug: p.slug,
    label2: p.label ?? 'production',
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a prompt to preview',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!picked) { return; }

  ctx.outputChannel.appendLine(`Fetching prompt: ${picked.slug}`);

  let template: PromptTemplate;
  try {
    const result = await ctx.client.callTool('airlancer.prompts.get', {
      slug: picked.slug,
      label: picked.label2,
    });
    template = result as PromptTemplate;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Failed to fetch prompt content: ${msg}`);
    vscode.window.showErrorMessage(`Failed to fetch prompt: ${msg}`);
    return;
  }

  // Open in a virtual document (readonly markdown preview).
  const content = ctx.promptsSync.formatPromptMd(template);
  const uri = vscode.Uri.parse(`untitled:${picked.slug}.md`);

  try {
    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
  } catch (err) {
    // Fallback: show in output channel.
    ctx.outputChannel.show();
    ctx.outputChannel.appendLine(`\n--- ${template.name} ---\n${content}`);
  }
}
