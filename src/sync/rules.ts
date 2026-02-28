import * as vscode from 'vscode';
import { AirlancerClient, Rule } from '../utils/client';

// ---------------------------------------------------------------------------
// Rules Sync Engine
//
// Syncs policy rules from the Airlancer platform into .cursor/rules/ as
// .mdc files that Cursor treats as project rules.
//
// Cursor Rules format (.mdc):
//   ---
//   description: Rule description
//   globs: ["*.ts", "*.tsx"]
//   alwaysApply: true
//   ---
//   <markdown content>
// ---------------------------------------------------------------------------

export class RulesSync {
  private client: AirlancerClient;
  private output: vscode.OutputChannel;
  private lastRules: Rule[] = [];

  constructor(client: AirlancerClient, output: vscode.OutputChannel) {
    this.client = client;
    this.output = output;
  }

  get rules(): Rule[] {
    return this.lastRules;
  }

  async sync(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder — skipping rules sync.');
      return 0;
    }

    const root = workspaceFolders[0].uri;
    const rules = await this.client.fetchRules();
    this.lastRules = rules;

    if (rules.length === 0) {
      this.output.appendLine('No rules to sync from platform.');
      return 0;
    }

    const rulesDir = vscode.Uri.joinPath(root, '.cursor', 'rules');
    await vscode.workspace.fs.createDirectory(rulesDir);

    let count = 0;
    for (const rule of rules) {
      try {
        const slug = this.slugify(rule.name);
        const content = this.formatRuleMdc(rule);
        const filePath = vscode.Uri.joinPath(rulesDir, `airlancer-${slug}.mdc`);
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
        count++;
      } catch (err) {
        this.output.appendLine(`Failed to write rule ${rule.name}: ${err}`);
      }
    }

    return count;
  }

  private formatRuleMdc(rule: Rule): string {
    const globs = rule.globs?.length
      ? JSON.stringify(rule.globs)
      : '[]';

    return `---
description: ${rule.description}
globs: ${globs}
alwaysApply: ${rule.alwaysApply ?? false}
source: airlancer
---

# ${rule.name}

${rule.content}
`;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
