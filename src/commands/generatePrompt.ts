import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';

// ---------------------------------------------------------------------------
// Generate Prompt Command
//
// Prompts the user to describe what prompt they need, calls
// airlancer.prompts.generate via MCP, shows the result in a new editor tab,
// and offers an option to save it as a team template.
// ---------------------------------------------------------------------------

export async function generatePromptCommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    vscode.window.showWarningMessage('Connect to Airlancer first.');
    return;
  }

  const description = await vscode.window.showInputBox({
    prompt: 'Describe what prompt you need',
    placeHolder: 'e.g. "A prompt for reviewing Go code for security vulnerabilities"',
    ignoreFocusOut: true,
  });

  if (!description) { return; }

  const categories = [
    'development',
    'review',
    'testing',
    'documentation',
    'security',
    'architecture',
    'general',
  ];

  const categoryItem = await vscode.window.showQuickPick(
    categories.map(c => ({ label: c })),
    { placeHolder: 'Select a category (optional)', canPickMany: false },
  );

  ctx.outputChannel.appendLine(`Generating prompt for: "${description}"...`);

  let generatedContent: string;
  let generatedName: string | undefined;

  try {
    const args: Record<string, unknown> = { description };
    if (categoryItem) { args.category = categoryItem.label; }

    const result = await ctx.client.callTool('airlancer.prompts.generate', args);
    const generated = result as {
      content?: string;
      name?: string;
      slug?: string;
      category?: string;
      variables?: Record<string, unknown>;
      modelHints?: string[];
    };

    generatedContent = generated.content ?? String(result);
    generatedName = generated.name;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`Prompt generation failed: ${msg}`);
    vscode.window.showErrorMessage(`Failed to generate prompt: ${msg}`);
    return;
  }

  // Show generated prompt in a new editor tab.
  const doc = await vscode.workspace.openTextDocument({
    content: generatedContent,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  ctx.outputChannel.appendLine('Generated prompt opened in editor.');

  // Offer to save as team template.
  const action = await vscode.window.showInformationMessage(
    'Prompt generated. Save as a team template?',
    'Save as Template',
    'Dismiss',
  );

  if (action === 'Save as Template') {
    const name = await vscode.window.showInputBox({
      prompt: 'Template name',
      placeHolder: generatedName ?? 'New Prompt Template',
      value: generatedName,
      ignoreFocusOut: true,
    });
    if (!name) { return; }

    try {
      await ctx.client.callTool('airlancer.prompts.create', {
        name,
        content: generatedContent,
        category: categoryItem?.label,
      });
      vscode.window.showInformationMessage(`Template "${name}" saved to platform.`);
      ctx.outputChannel.appendLine(`Saved generated template: ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save template: ${msg}`);
    }
  }
}
