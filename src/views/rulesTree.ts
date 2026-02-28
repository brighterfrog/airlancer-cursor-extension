import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Rules Tree View
// ---------------------------------------------------------------------------

export class RulesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const rulesDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.cursor', 'rules');
    try {
      const entries = await vscode.workspace.fs.readDirectory(rulesDir);
      const mdcFiles = entries.filter(([name, type]) =>
        type === vscode.FileType.File && name.startsWith('airlancer-') && name.endsWith('.mdc')
      );

      if (mdcFiles.length === 0) {
        const item = new vscode.TreeItem('No rules synced yet');
        item.iconPath = new vscode.ThemeIcon('info');
        return [item];
      }

      return mdcFiles.map(([name]) => {
        const displayName = name.replace('airlancer-', '').replace('.mdc', '');
        const item = new vscode.TreeItem(displayName, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('law');
        item.command = {
          command: 'vscode.open',
          title: 'Open Rule',
          arguments: [vscode.Uri.joinPath(rulesDir, name)],
        };
        return item;
      });
    } catch {
      const item = new vscode.TreeItem('No rules synced yet');
      item.iconPath = new vscode.ThemeIcon('info');
      return [item];
    }
  }
}
