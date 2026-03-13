import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';

// ---------------------------------------------------------------------------
// Edit Prompt with AI Command
//
// Takes selected text (or prompts for input), asks how to improve it, calls
// airlancer.prompts.refine via MCP, shows a diff preview, and offers Apply
// or Save as Template actions.
// ---------------------------------------------------------------------------

export async function editPromptWithAICommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  let originalText: string;

  if (editor && !editor.selection.isEmpty) {
    originalText = editor.document.getText(editor.selection);
  } else {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter the prompt text to improve',
      placeHolder: 'Paste your prompt here...',
      ignoreFocusOut: true,
    });
    if (!input) { return; }
    originalText = input;
  }

  const instructions = await vscode.window.showInputBox({
    prompt: 'How should this prompt be improved?',
    placeHolder: 'e.g. "Make it more concise" or "Add better error handling instructions"',
    ignoreFocusOut: true,
  });

  if (!instructions) { return; }

  ctx.outputChannel.appendLine('Refining prompt via Airlancer AI...');

  let refinedPrompt: string;
  let changes: string[] = [];
  let suggestions: string[] = [];

  try {
    const result = await ctx.client.callTool('airlancer.prompts.refine', {
      prompt: originalText,
      instructions,
    });
    const refined = result as {
      refinedPrompt?: string;
      changes?: string[];
      suggestions?: string[];
    };
    refinedPrompt = refined.refinedPrompt ?? String(result);
    changes = refined.changes ?? [];
    suggestions = refined.suggestions ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Prompt refinement failed: ${msg}`);
    vscode.window.showErrorMessage(`Failed to refine prompt: ${msg}`);
    return;
  }

  // Show diff in a split view using virtual documents.
  const originalUri = vscode.Uri.parse('untitled:original-prompt.md');
  const refinedUri = vscode.Uri.parse('untitled:refined-prompt.md');

  const originalDoc = await vscode.workspace.openTextDocument({ content: originalText, language: 'markdown' });
  const refinedDoc = await vscode.workspace.openTextDocument({ content: refinedPrompt, language: 'markdown' });

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalDoc.uri,
    refinedDoc.uri,
    'Original vs Refined Prompt',
  );

  // Log changes and suggestions to output channel.
  if (changes.length > 0) {
    ctx.outputChannel.appendLine(`Changes: ${changes.join('; ')}`);
  }
  if (suggestions.length > 0) {
    ctx.outputChannel.appendLine(`Suggestions: ${suggestions.join('; ')}`);
  }

  // Offer actions.
  const actions = ['Apply', 'Save as Template', 'Dismiss'];
  const action = await vscode.window.showInformationMessage(
    `Prompt refined. ${changes.length} change(s) made.`,
    ...actions,
  );

  if (action === 'Apply') {
    if (editor && !editor.selection.isEmpty) {
      await editor.edit(editBuilder => {
        editBuilder.replace(editor.selection, refinedPrompt);
      });
      ctx.outputChannel.appendLine('Applied refined prompt to editor.');
    } else {
      await vscode.env.clipboard.writeText(refinedPrompt);
      vscode.window.showInformationMessage('Refined prompt copied to clipboard.');
    }
  } else if (action === 'Save as Template') {
    await saveAsTemplate(ctx, refinedPrompt);
  }
}

async function saveAsTemplate(ctx: AirlancerContext, content: string): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Template name',
    placeHolder: 'e.g. Code Review Prompt',
    ignoreFocusOut: true,
  });
  if (!name) { return; }

  try {
    await ctx.client.callTool('airlancer.prompts.create', { name, content });
    vscode.window.showInformationMessage(`Template "${name}" saved to platform.`);
    ctx.outputChannel.appendLine(`Saved template: ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to save template: ${msg}`);
  }
}
