import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Skills Tree View
// ---------------------------------------------------------------------------

export class SkillsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) { return []; }

    const skillsDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.cursor', 'skills');
    try {
      const entries = await vscode.workspace.fs.readDirectory(skillsDir);
      const dirs = entries.filter(([, type]) => type === vscode.FileType.Directory);

      if (dirs.length === 0) {
        const item = new vscode.TreeItem('No skills synced yet');
        item.iconPath = new vscode.ThemeIcon('info');
        return [item];
      }

      return dirs.map(([name]) => {
        const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('mortar-board');
        item.command = {
          command: 'vscode.open',
          title: 'Open Skill',
          arguments: [vscode.Uri.joinPath(skillsDir, name, 'SKILL.md')],
        };
        return item;
      });
    } catch {
      const item = new vscode.TreeItem('No skills synced yet');
      item.iconPath = new vscode.ThemeIcon('info');
      return [item];
    }
  }
}
