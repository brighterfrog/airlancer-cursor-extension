import * as vscode from 'vscode';
import type { AirlancerContext } from '../extension';

// ---------------------------------------------------------------------------
// Show Status Command
// ---------------------------------------------------------------------------

export async function showStatusCommand(ctx: AirlancerContext): Promise<void> {
  if (!ctx.connected) {
    const action = await vscode.window.showInformationMessage(
      'Airlancer: Not connected',
      'Setup Wizard',
      'Connect',
    );
    if (action === 'Setup Wizard') {
      vscode.commands.executeCommand('airlancer.setup');
    } else if (action === 'Connect') {
      vscode.commands.executeCommand('airlancer.connect');
    }
    return;
  }

  try {
    const tools = await ctx.client.listTools();
    const costResult = await ctx.client.callTool('airlancer.cost.status', {});
    const costInfo = costResult && typeof costResult === 'object'
      ? costResult as Record<string, unknown>
      : null;

    let message = `Airlancer: Connected (${tools.length} tools)`;
    if (costInfo && costInfo.daily_budget_usd) {
      message += `\n\nBudget: $${costInfo.daily_remaining_usd}/$${costInfo.daily_budget_usd} daily remaining`;
    }

    const action = await vscode.window.showInformationMessage(
      message,
      'Sync Skills',
      'Sync Rules',
      'Open Dashboard',
      'Disconnect',
    );

    if (action === 'Sync Skills') {
      vscode.commands.executeCommand('airlancer.syncSkills');
    } else if (action === 'Sync Rules') {
      vscode.commands.executeCommand('airlancer.syncRules');
    } else if (action === 'Open Dashboard') {
      vscode.commands.executeCommand('airlancer.openDashboard');
    } else if (action === 'Disconnect') {
      vscode.commands.executeCommand('airlancer.disconnect');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Airlancer status check failed: ${msg}`);
  }
}
