import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Prompts Tree View
//
// Shows synced prompt templates grouped by category. Reads from the
// .cursor/prompts/ directory written by PromptsSync.
// ---------------------------------------------------------------------------

interface CategoryNode {
  type: 'category';
  name: string;
}

interface PromptNode {
  type: 'prompt';
  fileName: string;
  displayName: string;
  filePath: vscode.Uri;
}

type TreeNode = CategoryNode | PromptNode;

export class PromptsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // category → prompt file names
  private categoryMap: Map<string, PromptNode[]> = new Map();

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('folder');
      item.contextValue = 'promptCategory';
      return item;
    }

    const item = new vscode.TreeItem(element.displayName, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('file-text');
    item.tooltip = element.fileName;
    item.command = {
      command: 'vscode.open',
      title: 'Open Prompt',
      arguments: [element.filePath],
    };
    item.contextValue = 'promptTemplate';
    return item;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) { return []; }

    const promptsDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.cursor', 'prompts');

    if (!element) {
      // Root: return categories.
      await this.loadCategories(promptsDir);
      if (this.categoryMap.size === 0) {
        const item = new vscode.TreeItem('No prompts synced yet');
        (item as TreeNode & vscode.TreeItem).type = 'category'; // satisfy type
        item.iconPath = new vscode.ThemeIcon('info');
        return [];
      }
      return Array.from(this.categoryMap.keys()).map(name => ({
        type: 'category' as const,
        name,
      }));
    }

    if (element.type === 'category') {
      return this.categoryMap.get(element.name) ?? [];
    }

    return [];
  }

  private async loadCategories(promptsDir: vscode.Uri): Promise<void> {
    this.categoryMap.clear();

    try {
      const entries = await vscode.workspace.fs.readDirectory(promptsDir);
      const mdFiles = entries.filter(
        ([name, type]) => type === vscode.FileType.File && name.endsWith('.md'),
      );

      for (const [fileName] of mdFiles) {
        const filePath = vscode.Uri.joinPath(promptsDir, fileName);
        const category = await this.readCategory(filePath);
        const displayName = fileName.slice(0, -3).replace(/-/g, ' ');

        const node: PromptNode = {
          type: 'prompt',
          fileName,
          displayName,
          filePath,
        };

        const existing = this.categoryMap.get(category) ?? [];
        existing.push(node);
        this.categoryMap.set(category, existing);
      }
    } catch {
      // Directory does not exist yet.
    }
  }

  private async readCategory(filePath: vscode.Uri): Promise<string> {
    try {
      const raw = await vscode.workspace.fs.readFile(filePath);
      const text = Buffer.from(raw).toString('utf-8');
      const match = text.match(/^category:\s*(.+)$/m);
      return match?.[1]?.trim() ?? 'general';
    } catch {
      return 'general';
    }
  }
}
