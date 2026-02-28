import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Connection Status Tree View
//
// Shows connection status, server info, and quick action links in the
// Airlancer sidebar panel.
// ---------------------------------------------------------------------------

export class StatusTreeProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private connected = false;
  private serverVersion = '';
  private toolCount = 0;
  private serverUrl = '';

  setConnected(serverUrl: string, serverVersion: string, toolCount: number): void {
    this.connected = true;
    this.serverUrl = serverUrl;
    this.serverVersion = serverVersion;
    this.toolCount = toolCount;
    this._onDidChangeTreeData.fire(undefined);
  }

  setDisconnected(): void {
    this.connected = false;
    this.serverUrl = '';
    this.serverVersion = '';
    this.toolCount = 0;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  getChildren(): StatusItem[] {
    if (!this.connected) {
      return [
        new StatusItem('$(circle-slash) Not Connected', '', 'warning'),
        new StatusItem('$(gear) Run Setup Wizard', '', 'action', 'airlancer.setup'),
      ];
    }

    return [
      new StatusItem('$(pass-filled) Connected', this.serverUrl, 'success'),
      new StatusItem('$(versions) Server', `v${this.serverVersion}`, 'info'),
      new StatusItem('$(tools) Tools', `${this.toolCount} available`, 'info'),
      new StatusItem('$(sync) Sync Skills', '', 'action', 'airlancer.syncSkills'),
      new StatusItem('$(law) Sync Rules', '', 'action', 'airlancer.syncRules'),
      new StatusItem('$(link-external) Open Dashboard', '', 'action', 'airlancer.openDashboard'),
      new StatusItem('$(debug-disconnect) Disconnect', '', 'action', 'airlancer.disconnect'),
    ];
  }
}

class StatusItem extends vscode.TreeItem {
  constructor(label: string, detail: string, kind: 'success' | 'warning' | 'info' | 'action', command?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;

    if (command) {
      this.command = { command, title: label };
    }

    if (kind === 'warning') {
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    }
  }
}
