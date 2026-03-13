import * as vscode from 'vscode';
import { DEFAULT_DASHBOARD_URL } from './generated/config';
import { AirlancerClient } from './utils/client';
import { StatusBarManager } from './utils/statusbar';
import { SecretStorage } from './utils/secrets';
import { connectCommand, disconnectCommand } from './commands/connect';
import { setupWizardCommand } from './commands/setup';
import { syncSkillsCommand } from './commands/syncSkills';
import { syncRulesCommand } from './commands/syncRules';
import { syncPromptsCommand } from './commands/syncPrompts';
import { browsePromptsCommand } from './commands/browsePrompts';
import { insertPromptCommand } from './commands/insertPrompt';
import { editPromptWithAICommand } from './commands/editPromptWithAI';
import { generatePromptCommand } from './commands/generatePrompt';
import { promptWizardCommand } from './commands/promptWizard';
import { showStatusCommand } from './commands/status';
import { createApiKeyCommand } from './commands/apikey';
import { SkillsSync } from './sync/skills';
import { RulesSync } from './sync/rules';
import { PromptsSync } from './sync/prompts';
import { CursorRulesSync } from './sync/cursorrules';
import { McpRegistrar } from './utils/mcp';
import { ToolsTreeProvider } from './views/tools';
import { SkillsTreeProvider } from './views/skillsTree';
import { RulesTreeProvider } from './views/rulesTree';
import { PromptsTreeProvider } from './views/promptsTree';
import { StatusTreeProvider } from './views/statusTree';

// ---------------------------------------------------------------------------
// Global Extension State
// ---------------------------------------------------------------------------

export interface AirlancerContext {
  client: AirlancerClient;
  secrets: SecretStorage;
  statusBar: StatusBarManager;
  statusTree: StatusTreeProvider;
  mcpRegistrar: McpRegistrar;
  skillsSync: SkillsSync;
  rulesSync: RulesSync;
  promptsSync: PromptsSync;
  cursorRulesSync: CursorRulesSync;
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
  const promptsSync = new PromptsSync(client, outputChannel);
  const cursorRulesSync = new CursorRulesSync(client, outputChannel);
  const statusTree = new StatusTreeProvider();

  ctx = {
    client,
    secrets,
    statusBar,
    statusTree,
    mcpRegistrar,
    skillsSync,
    rulesSync,
    promptsSync,
    cursorRulesSync,
    connected: false,
    outputChannel,
  };

  // Register tree view providers.
  const toolsProvider = new ToolsTreeProvider();
  const skillsProvider = new SkillsTreeProvider();
  const rulesProvider = new RulesTreeProvider();
  const promptsProvider = new PromptsTreeProvider();
  vscode.window.registerTreeDataProvider('airlancer.status', statusTree);
  vscode.window.registerTreeDataProvider('airlancer.tools', toolsProvider);
  vscode.window.registerTreeDataProvider('airlancer.skills', skillsProvider);
  vscode.window.registerTreeDataProvider('airlancer.rules', rulesProvider);
  vscode.window.registerTreeDataProvider('airlancer.prompts', promptsProvider);

  // Register commands.
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('airlancer.connect', () => connectCommand(ctx, toolsProvider)),
    vscode.commands.registerCommand('airlancer.disconnect', () => disconnectCommand(ctx)),
    vscode.commands.registerCommand('airlancer.setup', () => setupWizardCommand(extensionContext, ctx)),
    vscode.commands.registerCommand('airlancer.syncSkills', () => syncSkillsCommand(ctx, skillsProvider)),
    vscode.commands.registerCommand('airlancer.syncRules', () => syncRulesCommand(ctx, rulesProvider)),
    vscode.commands.registerCommand('airlancer.syncPrompts', () => syncPromptsCommand(ctx, promptsProvider)),
    vscode.commands.registerCommand('airlancer.browsePrompts', () => browsePromptsCommand(ctx)),
    vscode.commands.registerCommand('airlancer.insertPrompt', () => insertPromptCommand(ctx)),
    vscode.commands.registerCommand('airlancer.editPromptWithAI', () => editPromptWithAICommand(ctx)),
    vscode.commands.registerCommand('airlancer.generatePrompt', () => generatePromptCommand(ctx)),
    vscode.commands.registerCommand('airlancer.promptWizard', () => promptWizardCommand(extensionContext, ctx)),
    vscode.commands.registerCommand('airlancer.showStatus', () => showStatusCommand(ctx)),
    vscode.commands.registerCommand('airlancer.createApiKey', () => createApiKeyCommand(ctx)),
    vscode.commands.registerCommand('airlancer.openDashboard', () => {
      const url = vscode.workspace.getConfiguration('airlancer').get<string>('dashboardUrl', DEFAULT_DASHBOARD_URL);
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
  const promptsInterval = config.get<number>('promptsSyncInterval', 300);

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

  if (promptsInterval > 0) {
    const timer = setInterval(async () => {
      if (ctx.connected) {
        await syncPromptsCommand(ctx, promptsProvider);
      }
    }, promptsInterval * 1000);
    extensionContext.subscriptions.push({ dispose: () => clearInterval(timer) });
  }

  outputChannel.appendLine('Airlancer extension activated.');
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export async function deactivate(): Promise<void> {
  if (ctx) {
    try { ctx.outputChannel.appendLine('Airlancer extension deactivating...'); } catch { /* disposed */ }
    await ctx.mcpRegistrar.unregister();
    // statusBar and outputChannel disposal handled by extensionContext.subscriptions
  }
}
