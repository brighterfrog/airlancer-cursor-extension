import * as vscode from 'vscode';
import { AirlancerClient } from '../utils/client';

// ---------------------------------------------------------------------------
// Prompt Sync Engine
//
// Syncs prompt templates from the Airlancer platform into .cursor/prompts/
// as markdown files with YAML frontmatter.
//
// Cursor Prompts format:
//   .cursor/prompts/<slug>.md
//   ---
//   name: Prompt Name
//   slug: prompt-slug
//   category: development
//   variables: {language: {type: string, required: true}}
//   modelHints: [claude-sonnet-4-5]
//   tags: [review, quality]
//   source: airlancer
//   ---
//   You are a senior {{language}} engineer...
// ---------------------------------------------------------------------------

export interface PromptSummary {
  slug: string;
  name: string;
  category: string;
  tags: string[];
  label: string;
  version: number;
}

export interface PromptVariable {
  type: string;
  required?: boolean;
  description?: string;
  default?: string;
}

export interface PromptTemplate {
  slug: string;
  name: string;
  category: string;
  tags: string[];
  label: string;
  version: number;
  content: string;
  variables?: Record<string, PromptVariable>;
  modelHints?: string[];
}

export class PromptsSync {
  private client: AirlancerClient;
  private output: vscode.OutputChannel;
  private lastPrompts: PromptSummary[] = [];

  constructor(client: AirlancerClient, output: vscode.OutputChannel) {
    this.client = client;
    this.output = output;
  }

  get prompts(): PromptSummary[] {
    return this.lastPrompts;
  }

  async sync(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder — skipping prompts sync.');
      return 0;
    }

    const root = workspaceFolders[0].uri;
    const summaries = await this.fetchPromptList();
    this.lastPrompts = summaries;

    if (summaries.length === 0) {
      this.output.appendLine('No prompts to sync from platform.');
      return 0;
    }

    const promptsDir = vscode.Uri.joinPath(root, '.cursor', 'prompts');
    await vscode.workspace.fs.createDirectory(promptsDir);

    // Track which slugs are current so we can clean up removed prompts.
    const currentSlugs = new Set(summaries.map(s => s.slug));
    await this.cleanupRemovedPrompts(promptsDir, currentSlugs);

    let count = 0;
    for (const summary of summaries) {
      try {
        const template = await this.fetchPromptFull(summary.slug, summary.label);
        const content = this.formatPromptMd(template);
        const filePath = vscode.Uri.joinPath(promptsDir, `${summary.slug}.md`);
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
        count++;
      } catch (err) {
        this.output.appendLine(`Failed to write prompt ${summary.slug}: ${err}`);
      }
    }

    return count;
  }

  private async fetchPromptList(): Promise<PromptSummary[]> {
    const result = await this.client.callTool('airlancer.prompts.list', { label: 'production' });
    if (Array.isArray(result)) {
      return result as PromptSummary[];
    }
    if (result && typeof result === 'object' && 'prompts' in (result as Record<string, unknown>)) {
      return (result as Record<string, unknown>).prompts as PromptSummary[];
    }
    return [];
  }

  private async fetchPromptFull(slug: string, label?: string): Promise<PromptTemplate> {
    const args: Record<string, unknown> = { slug };
    if (label) { args.label = label; }
    const result = await this.client.callTool('airlancer.prompts.get', args);
    return result as PromptTemplate;
  }

  private async cleanupRemovedPrompts(
    promptsDir: vscode.Uri,
    currentSlugs: Set<string>,
  ): Promise<void> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(promptsDir);
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.md')) {
          const slug = name.slice(0, -3);
          if (!currentSlugs.has(slug)) {
            const filePath = vscode.Uri.joinPath(promptsDir, name);
            await vscode.workspace.fs.delete(filePath);
            this.output.appendLine(`Removed stale prompt: ${name}`);
          }
        }
      }
    } catch {
      // Directory may not exist yet — ignore.
    }
  }

  formatPromptMd(template: PromptTemplate): string {
    const tags = template.tags?.length ? JSON.stringify(template.tags) : '[]';
    const modelHints = template.modelHints?.length ? JSON.stringify(template.modelHints) : '[]';
    const variables = template.variables
      ? JSON.stringify(template.variables)
      : '{}';

    return `---
name: ${template.name}
slug: ${template.slug}
category: ${template.category ?? 'general'}
variables: ${variables}
modelHints: ${modelHints}
tags: ${tags}
source: airlancer
---

${template.content}
`;
  }
}
