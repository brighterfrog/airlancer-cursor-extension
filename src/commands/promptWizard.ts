import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { AirlancerContext } from '../extension';
import type { PromptTemplate } from '../sync/prompts';
import { getPromptWizardHtml } from '../webview/promptWizard';

// ---------------------------------------------------------------------------
// Prompt Wizard Command
//
// Opens a webview panel with a multi-step wizard:
//   Step 1: Choose (browse team prompts) or Generate (AI-generated prompt)
//   Step 2: Fill in variables (dynamic form from prompt schema)
//   Step 2.5: AI Refine (optional — tweak the resolved prompt)
//   Step 3: Preview & Submit (copy to chat, insert in editor, save as template)
// ---------------------------------------------------------------------------

export async function promptWizardCommand(
  extensionContext: vscode.ExtensionContext,
  ctx: AirlancerContext,
): Promise<void> {
  if (!ctx.connected) {
    const choice = await vscode.window.showWarningMessage(
      'Connect to Airlancer before using the Prompt Wizard.',
      'Connect Now',
    );
    if (choice === 'Connect Now') {
      vscode.commands.executeCommand('airlancer.connect');
    }
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'airlancerPromptWizard',
    'Prompt Wizard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionContext.extensionUri, 'media'),
      ],
    },
  );

  const nonce = crypto.randomBytes(16).toString('hex');
  panel.webview.html = getPromptWizardHtml(nonce);

  // Handle messages from the webview.
  panel.webview.onDidReceiveMessage(async (message: { type: string; [key: string]: unknown }) => {
    switch (message.type) {

      // ── Step 1: Fetch prompt list ──────────────────────────────────────────
      case 'fetchPrompts': {
        try {
          const search = message.search as string | undefined;
          const category = message.category as string | undefined;
          const args: Record<string, unknown> = { label: 'production' };
          if (category) { args.category = category; }
          const result = await ctx.client.callTool('airlancer.prompts.list', args);
          let prompts: unknown[] = [];
          if (Array.isArray(result)) {
            prompts = result;
          } else if (result && typeof result === 'object' && 'prompts' in (result as Record<string, unknown>)) {
            prompts = (result as Record<string, unknown>).prompts as unknown[];
          }
          if (search) {
            const q = search.toLowerCase();
            prompts = prompts.filter((p: unknown) => {
              const pr = p as Record<string, unknown>;
              return (
                String(pr.name ?? '').toLowerCase().includes(q) ||
                String(pr.category ?? '').toLowerCase().includes(q) ||
                (Array.isArray(pr.tags) && pr.tags.some((t: unknown) => String(t).toLowerCase().includes(q)))
              );
            });
          }
          panel.webview.postMessage({ type: 'promptsLoaded', prompts });
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: failed to fetch prompts: ${err}`);
          panel.webview.postMessage({
            type: 'promptsError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ── Step 1: Fetch full template ────────────────────────────────────────
      case 'getPrompt': {
        const slug = message.slug as string;
        const label = (message.label as string) ?? 'production';
        try {
          const result = await ctx.client.callTool('airlancer.prompts.get', { slug, label });
          const template = result as PromptTemplate;
          panel.webview.postMessage({ type: 'templateLoaded', template });
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: failed to load template "${slug}": ${err}`);
          panel.webview.postMessage({
            type: 'templateError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ── Step 1: Generate new prompt via AI ────────────────────────────────
      case 'generatePrompt': {
        const description = message.description as string;
        try {
          const result = await ctx.client.callTool('airlancer.prompts.generate', { description });
          const content = extractStringContent(result);
          panel.webview.postMessage({ type: 'generateDone', content });
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: generate failed: ${err}`);
          panel.webview.postMessage({
            type: 'generateError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ── Step 2: Resolve variables ──────────────────────────────────────────
      case 'resolvePrompt': {
        const slug = message.slug as string;
        const variables = message.variables as Record<string, string>;
        try {
          const result = await ctx.client.callTool('airlancer.prompts.resolve', { slug, variables });
          const content = extractStringContent(result);
          panel.webview.postMessage({ type: 'resolveDone', content });
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: resolve failed: ${err}`);
          panel.webview.postMessage({
            type: 'resolveError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ── Step 2.5: Refine via AI ────────────────────────────────────────────
      case 'refinePrompt': {
        const prompt = message.prompt as string;
        const instructions = message.instructions as string;
        try {
          const result = await ctx.client.callTool('airlancer.prompts.refine', { prompt, instructions });
          const content = extractStringContent(result);
          panel.webview.postMessage({ type: 'refineDone', content });
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: refine failed: ${err}`);
          panel.webview.postMessage({
            type: 'refineError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ── Step 3: Copy to Cursor chat ────────────────────────────────────────
      case 'copyToChat': {
        const content = message.content as string;
        await vscode.env.clipboard.writeText(content);
        // Attempt to open Cursor/VS Code chat panel.
        try {
          await vscode.commands.executeCommand('workbench.action.chat.open');
        } catch {
          // Command may not exist in all IDE versions — not fatal.
        }
        panel.webview.postMessage({ type: 'copied' });
        ctx.outputChannel.appendLine('Prompt Wizard: content copied to clipboard.');
        break;
      }

      // ── Step 3: Insert at cursor in active editor ──────────────────────────
      case 'insertInEditor': {
        const content = message.content as string;
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor. Open a file first.');
          return;
        }
        await editor.edit(editBuilder => {
          const pos = editor.selection.active;
          editBuilder.insert(pos, content);
        });
        panel.webview.postMessage({ type: 'inserted' });
        ctx.outputChannel.appendLine('Prompt Wizard: content inserted into editor.');
        break;
      }

      // ── Step 3: Save as platform template ─────────────────────────────────
      case 'saveAsTemplate': {
        const name = message.name as string;
        const content = message.content as string;
        const variables = message.variables as Record<string, unknown>;
        const category = (message.category as string) ?? 'general';
        const tags = (message.tags as string[]) ?? [];
        try {
          await ctx.client.callTool('airlancer.prompts.create', {
            name,
            content,
            variables,
            category,
            tags,
            label: 'production',
          });
          panel.webview.postMessage({ type: 'saved' });
          ctx.outputChannel.appendLine(`Prompt Wizard: saved template "${name}".`);
        } catch (err) {
          ctx.outputChannel.appendLine(`Prompt Wizard: save failed: ${err}`);
          panel.webview.postMessage({
            type: 'saveError',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Extract a string from varied MCP tool response shapes.
// ---------------------------------------------------------------------------
function extractStringContent(result: unknown): string {
  if (typeof result === 'string') { return result; }
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.content === 'string') { return r.content; }
    if (typeof r.text === 'string') { return r.text; }
    if (typeof r.result === 'string') { return r.result; }
    if (typeof r.prompt === 'string') { return r.prompt; }
  }
  return JSON.stringify(result);
}
