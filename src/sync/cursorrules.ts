import * as vscode from 'vscode';
import { AirlancerClient } from '../utils/client';

// ---------------------------------------------------------------------------
// CursorRules Sync Engine
//
// Fetches the team .cursorrules content from the platform and writes it to
// the workspace root. Only overwrites when content differs to avoid
// unnecessary file system churn.
// ---------------------------------------------------------------------------

export class CursorRulesSync {
  private client: AirlancerClient;
  private output: vscode.OutputChannel;

  constructor(client: AirlancerClient, output: vscode.OutputChannel) {
    this.client = client;
    this.output = output;
  }

  async sync(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder — skipping .cursorrules sync.');
      return false;
    }

    const root = workspaceFolders[0].uri;
    const content = await this.fetchCursorRules();
    if (!content) {
      this.output.appendLine('No .cursorrules content from platform.');
      return false;
    }

    const filePath = vscode.Uri.joinPath(root, '.cursorrules');

    // Only write if content differs to avoid triggering file watchers unnecessarily.
    try {
      const existing = await vscode.workspace.fs.readFile(filePath);
      const existingText = Buffer.from(existing).toString('utf-8');
      if (existingText === content) {
        this.output.appendLine('.cursorrules unchanged — skipping write.');
        return false;
      }
    } catch {
      // File does not exist yet — will be written below.
    }

    await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
    this.output.appendLine('.cursorrules updated from platform.');
    return true;
  }

  private async fetchCursorRules(): Promise<string | null> {
    try {
      const result = await this.client.callTool('airlancer.rules.list', {});
      if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        if (typeof obj.cursorRulesContent === 'string') {
          return obj.cursorRulesContent;
        }
      }
      return null;
    } catch (err) {
      this.output.appendLine(`Failed to fetch .cursorrules: ${err}`);
      return null;
    }
  }
}
