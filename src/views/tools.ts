import * as vscode from 'vscode';
import type { McpTool } from '../utils/client';

// ---------------------------------------------------------------------------
// MCP Tools Tree View
// ---------------------------------------------------------------------------

export class ToolsTreeProvider implements vscode.TreeDataProvider<ToolItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ToolItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private tools: McpTool[] = [];

  setTools(tools: McpTool[]): void {
    this.tools = tools;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ToolItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolItem[] {
    if (this.tools.length === 0) {
      return [new ToolItem('No tools available', 'Connect to see MCP tools', 'info')];
    }

    return this.tools.map(t => {
      const category = t.name.split('.')[1] ?? 'other';
      return new ToolItem(t.name, t.description, category);
    });
  }
}

class ToolItem extends vscode.TreeItem {
  constructor(name: string, description: string, category: string) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = category;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(this.iconForCategory(category));
  }

  private iconForCategory(cat: string): string {
    switch (cat) {
      case 'knowledge': return 'book';
      case 'agents': return 'hubot';
      case 'rules': return 'law';
      case 'workflow': return 'play-circle';
      case 'stories': return 'tasklist';
      case 'architecture': return 'symbol-structure';
      case 'dataroom': return 'database';
      case 'cost': return 'credit-card';
      default: return 'extensions';
    }
  }
}
