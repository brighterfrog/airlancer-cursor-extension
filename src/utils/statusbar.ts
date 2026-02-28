import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Status Bar Manager
//
// Shows Airlancer connection status in the VS Code/Cursor status bar.
// Clicking the item opens the command palette with Airlancer commands.
// ---------------------------------------------------------------------------

export class StatusBarManager {
  public readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.item.command = 'airlancer.showStatus';
    this.setDisconnected();
    this.item.show();
  }

  setConnected(toolCount: number): void {
    this.item.text = `$(rocket) Airlancer (${toolCount} tools)`;
    this.item.tooltip = `Connected to Airlancer — ${toolCount} MCP tools available`;
    this.item.backgroundColor = undefined;
  }

  setConnecting(): void {
    this.item.text = '$(loading~spin) Airlancer...';
    this.item.tooltip = 'Connecting to Airlancer...';
    this.item.backgroundColor = undefined;
  }

  setDisconnected(): void {
    this.item.text = '$(circle-slash) Airlancer';
    this.item.tooltip = 'Not connected — click to set up';
    this.item.command = 'airlancer.setup';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  setError(message: string): void {
    this.item.text = '$(error) Airlancer';
    this.item.tooltip = `Connection error: ${message}`;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  dispose(): void {
    this.item.dispose();
  }
}
