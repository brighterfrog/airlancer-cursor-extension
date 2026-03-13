import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';
import type { PromptSummary, PromptVariable } from '../sync/prompts';

// ---------------------------------------------------------------------------
// Insert Prompt Command
//
// Lists prompts, lets the user select one, collects required variable values
// via InputBox, resolves the template via MCP, then inserts the resolved text
// at the cursor position in the active editor. Falls back to clipboard.
// ---------------------------------------------------------------------------

export async function insertPromptCommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  // Fetch prompt list.
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
    vscode.window.showErrorMessage(`Failed to fetch prompts: ${msg}`);
    return;
  }

  if (summaries.length === 0) {
    vscode.window.showInformationMessage('No prompts available on this platform.');
    return;
  }

  const items: (vscode.QuickPickItem & { slug: string; promptLabel: string })[] = summaries.map(p => ({
    label: `$(file) ${p.name}`,
    description: p.category,
    detail: p.tags?.length ? `[${p.tags.join(', ')}]` : undefined,
    slug: p.slug,
    promptLabel: p.label ?? 'production',
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a prompt to insert',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!picked) { return; }

  // Fetch the full template to get the variables schema.
  let variables: Record<string, PromptVariable> = {};
  try {
    const result = await ctx.client.callTool('airlancer.prompts.get', {
      slug: picked.slug,
      label: picked.promptLabel,
    });
    const template = result as { variables?: Record<string, PromptVariable> };
    variables = template.variables ?? {};
  } catch (err) {
    ctx.outputChannel.appendLine(`Failed to fetch template variables: ${err}`);
    // Continue without variables.
  }

  // Collect values for required variables.
  const variableValues: Record<string, string> = {};
  for (const [varName, varDef] of Object.entries(variables)) {
    const isRequired = varDef.required !== false;
    const prompt = varDef.description
      ? `${varName}: ${varDef.description}`
      : `Enter value for {{${varName}}}`;

    const value = await vscode.window.showInputBox({
      prompt,
      placeHolder: varDef.default ?? varName,
      value: varDef.default,
      ignoreFocusOut: true,
    });

    if (value === undefined) {
      // User cancelled.
      return;
    }

    if (isRequired && !value.trim()) {
      vscode.window.showWarningMessage(`Variable "${varName}" is required.`);
      return;
    }

    if (value.trim()) {
      variableValues[varName] = value.trim();
    }
  }

  // Resolve the prompt via MCP.
  let resolvedContent: string;
  try {
    const result = await ctx.client.callTool('airlancer.prompts.resolve', {
      slug: picked.slug,
      variables: variableValues,
      label: picked.promptLabel,
    });
    const resolved = result as { resolvedContent?: string; model_hints?: string[] };
    resolvedContent = resolved.resolvedContent ?? String(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to resolve prompt: ${msg}`);
    return;
  }

  // Insert at cursor or copy to clipboard.
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await editor.edit(editBuilder => {
      for (const selection of editor.selections) {
        editBuilder.replace(selection, resolvedContent);
      }
    });
    ctx.outputChannel.appendLine(`Inserted resolved prompt: ${picked.slug}`);
  } else {
    await vscode.env.clipboard.writeText(resolvedContent);
    vscode.window.showInformationMessage('Prompt copied to clipboard (no active editor).');
    ctx.outputChannel.appendLine(`Copied resolved prompt to clipboard: ${picked.slug}`);
  }
}
