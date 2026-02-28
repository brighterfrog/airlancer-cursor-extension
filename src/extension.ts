import * as vscode from 'vscode';
import { AirlancerClient } from './utils/client';
import { StatusBarManager } from './utils/statusbar';
import { SecretStorage } from './utils/secrets';
import { connectCommand, disconnectCommand } from './commands/connect';
import { setupWizardCommand } from './commands/setup';
import { syncSkillsCommand } from './commands/syncSkills';
import { syncRulesCommand } from './commands/syncRules';
import { showStatusCommand } from './commands/status';
import { createApiKeyCommand } from './commands/apikey';
import { SkillsSync } from './sync/skills';
import { RulesSync } from './sync/rules';
import { McpRegistrar } from './utils/mcp';
import { ToolsTreeProvider } from './views/tools';
import { SkillsTreeProvider } from './views/skillsTree';
import { RulesTreeProvider } from './views/rulesTree';

// ---------------------------------------------------------------------------
// Global Extension State
// ---------------------------------------------------------------------------

export interface AirlancerContext {
  client: AirlancerClient;
  secrets: SecretStorage;
  statusBar: StatusBarManager;
  mcpRegistrar: McpRegistrar;
  skillsSync: SkillsSync;
  rulesSync: RulesSync;
  connected: boolean;
  outputChannel: vscode.OutputChannel;
}

let ctx: AirlancerContext;

export function getContext(): AirlancerContext {
  return ctx;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Airlancer');
  outputChannel.appendLine('Airlancer extension activating...');

  // Initialize subsystems.
  const secrets = new SecretStorage(extensionContext);
  const client = new AirlancerClient(outputChannel);
  const statusBar = new StatusBarManager();
  const mcpRegistrar = new McpRegistrar(outputChannel);
  const skillsSync = new SkillsSync(client, outputChannel);
  const rulesSync = new RulesSync(client, outputChannel);

  ctx = {
    client,
    secrets,
    statusBar,
    mcpRegistrar,
    skillsSync,
    rulesSync,
    connected: false,
    outputChannel,
  };

  // Register tree view providers.
  const toolsProvider = new ToolsTreeProvider();
  const skillsProvider = new SkillsTreeProvider();
  const rulesProvider = new RulesTreeProvider();
  vscode.window.registerTreeDataProvider('airlancer.tools', toolsProvider);
  vscode.window.registerTreeDataProvider('airlancer.skills', skillsProvider);
  vscode.window.registerTreeDataProvider('airlancer.rules', rulesProvider);

  // Register commands.
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('airlancer.connect', () => connectCommand(ctx, toolsProvider)),
    vscode.commands.registerCommand('airlancer.disconnect', () => disconnectCommand(ctx)),
    vscode.commands.registerCommand('airlancer.setup', () => setupWizardCommand(extensionContext, ctx)),
    vscode.commands.registerCommand('airlancer.syncSkills', () => syncSkillsCommand(ctx, skillsProvider)),
    vscode.commands.registerCommand('airlancer.syncRules', () => syncRulesCommand(ctx, rulesProvider)),
    vscode.commands.registerCommand('airlancer.showStatus', () => showStatusCommand(ctx)),
    vscode.commands.registerCommand('airlancer.createApiKey', () => createApiKeyCommand(ctx)),
    vscode.commands.registerCommand('airlancer.openDashboard', () => {
      const url = vscode.workspace.getConfiguration('airlancer').get<string>('dashboardUrl', 'https://adlc-dev.airlancer.ai');
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    statusBar.item,
    outputChannel,
  );

  // Auto-connect on startup if configured.
  const config = vscode.workspace.getConfiguration('airlancer');
  if (config.get<boolean>('autoConnect', true)) {
    const apiKey = await secrets.getApiKey();
    if (apiKey) {
      outputChannel.appendLine('Auto-connecting with stored API key...');
      await connectCommand(ctx, toolsProvider);
    } else {
      outputChannel.appendLine('No API key stored. Run "Airlancer: Setup Wizard" to get started.');
      statusBar.setDisconnected();
    }
  }

  // Start periodic sync timers.
  const skillsInterval = config.get<number>('skillsSyncInterval', 300);
  const rulesInterval = config.get<number>('rulesSyncInterval', 300);

  if (skillsInterval > 0) {
    const timer = setInterval(async () => {
      if (ctx.connected) {
        await syncSkillsCommand(ctx, skillsProvider);
      }
    }, skillsInterval * 1000);
    extensionContext.subscriptions.push({ dispose: () => clearInterval(timer) });
  }

  if (rulesInterval > 0) {
    const timer = setInterval(async () => {
      if (ctx.connected) {
        await syncRulesCommand(ctx, rulesProvider);
      }
    }, rulesInterval * 1000);
    extensionContext.subscriptions.push({ dispose: () => clearInterval(timer) });
  }

  outputChannel.appendLine('Airlancer extension activated.');
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export function deactivate(): void {
  if (ctx) {
    ctx.mcpRegistrar.unregister();
    ctx.statusBar.dispose();
    ctx.outputChannel.appendLine('Airlancer extension deactivated.');
  }
}
