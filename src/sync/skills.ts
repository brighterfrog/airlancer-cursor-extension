import * as vscode from 'vscode';
import { AirlancerClient, Skill } from '../utils/client';

// ---------------------------------------------------------------------------
// Skills Sync Engine
//
// Syncs skills from the Airlancer platform into .cursor/skills/ as SKILL.md
// files with YAML frontmatter that Cursor understands.
//
// Cursor Skills format:
//   .cursor/skills/<name>/SKILL.md
//   ---
//   name: Skill Name
//   triggers:
//     - keyword1
//     - keyword2
//   ---
//   <markdown content>
// ---------------------------------------------------------------------------

export class SkillsSync {
  private client: AirlancerClient;
  private output: vscode.OutputChannel;
  private lastSkills: Skill[] = [];

  constructor(client: AirlancerClient, output: vscode.OutputChannel) {
    this.client = client;
    this.output = output;
  }

  get skills(): Skill[] {
    return this.lastSkills;
  }

  async sync(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.output.appendLine('No workspace folder — skipping skills sync.');
      return 0;
    }

    const root = workspaceFolders[0].uri;
    const skills = await this.client.fetchSkills();
    this.lastSkills = skills;

    if (skills.length === 0) {
      this.output.appendLine('No skills to sync from platform.');
      return 0;
    }

    const skillsDir = vscode.Uri.joinPath(root, '.cursor', 'skills');
    await vscode.workspace.fs.createDirectory(skillsDir);

    let count = 0;
    for (const skill of skills) {
      try {
        const slug = this.slugify(skill.name);
        const dir = vscode.Uri.joinPath(skillsDir, slug);
        await vscode.workspace.fs.createDirectory(dir);

        const content = this.formatSkillMd(skill);
        const filePath = vscode.Uri.joinPath(dir, 'SKILL.md');
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
        count++;
      } catch (err) {
        this.output.appendLine(`Failed to write skill ${skill.name}: ${err}`);
      }
    }

    return count;
  }

  private formatSkillMd(skill: Skill): string {
    const triggers = skill.triggers?.length
      ? skill.triggers.map(t => `  - ${t}`).join('\n')
      : '  - ' + this.slugify(skill.name);

    return `---
name: ${skill.name}
description: ${skill.description}
triggers:
${triggers}
source: airlancer
---

${skill.content}
`;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
