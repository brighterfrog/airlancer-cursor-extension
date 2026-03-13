import * as vscode from 'vscode';
import { version as EXTENSION_VERSION } from '../../package.json';

// ---------------------------------------------------------------------------
// Airlancer Platform Client
//
// Handles all HTTP communication with the Airlancer MCP server and platform
// API. Used for connection testing, tool discovery, skills/rules fetching,
// and API key management.
// ---------------------------------------------------------------------------

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  triggers: string[];
  updatedAt: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  globs: string[];
  alwaysApply: boolean;
  updatedAt: string;
}

export interface ConnectionStatus {
  connected: boolean;
  serverVersion: string;
  toolCount: number;
  tenantId: string;
  error?: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt?: string;
}

export interface IDEConfig {
  tenantId: string;
  role: string;
  scopes: string[];
  mcpConfig: {
    type: string;
    url: string;
    headers: Record<string, string>;
  };
}

export class AirlancerClient {
  private apiKey: string = '';
  private serverUrl: string = '';
  private output: vscode.OutputChannel;
  private nextId: number = 1;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  configure(serverUrl: string, apiKey: string): void {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  get isConfigured(): boolean {
    return !!this.serverUrl && !!this.apiKey;
  }

  // --- MCP Protocol Methods ---

  async initialize(): Promise<ConnectionStatus> {
    try {
      const result = await this.mcpCall('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'airlancer-cursor-extension', version: EXTENSION_VERSION },
      });
      const serverInfo = result?.serverInfo as Record<string, unknown> | undefined;

      // Send MCP initialized notification (protocol requirement).
      try {
        await this.mcpNotify('notifications/initialized', {});
      } catch {
        // Non-fatal — some servers don't require this.
      }

      return {
        connected: true,
        serverVersion: (serverInfo?.version as string) ?? 'unknown',
        toolCount: 0,
        tenantId: '',
      };
    } catch (err) {
      return {
        connected: false,
        serverVersion: '',
        toolCount: 0,
        tenantId: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.mcpCall('tools/list', null);
    return (result?.tools as McpTool[]) ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.mcpCall('tools/call', { name, arguments: args });
  }

  // --- Platform API Methods ---

  async fetchSkills(): Promise<Skill[]> {
    const result = await this.callTool('airlancer.rules.list', {});
    // Skills come from the platform's skills registry.
    // For now, we pull from the rules engine which includes both.
    if (result && typeof result === 'object' && 'skills' in (result as Record<string, unknown>)) {
      return (result as Record<string, unknown>).skills as Skill[];
    }
    return [];
  }

  async fetchRules(): Promise<Rule[]> {
    const result = await this.callTool('airlancer.rules.list', {});
    if (result && typeof result === 'object' && 'rules' in (result as Record<string, unknown>)) {
      return (result as Record<string, unknown>).rules as Rule[];
    }
    return [];
  }

  async createApiKey(name: string, scopes: string[], expiresIn: string): Promise<ApiKeyCreateResponse> {
    const resp = await this.httpPost('/api/v1/api-keys', { name, scopes, expiresIn });
    return resp as ApiKeyCreateResponse;
  }

  async fetchIDEConfig(): Promise<IDEConfig> {
    const resp = await this.httpGet('/api/v1/ide/config');
    return resp as IDEConfig;
  }

  // --- Internal HTTP ---

  private async mcpCall(method: string, params: unknown): Promise<Record<string, unknown>> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: this.nextId++,
      method,
      params,
    });

    const resp = await fetch(`${this.serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      throw new Error(`MCP request failed: ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json() as Record<string, unknown>;
    if (json.error) {
      const err = json.error as Record<string, unknown>;
      throw new Error(`MCP error: ${err.message ?? JSON.stringify(err)}`);
    }

    return json.result as Record<string, unknown>;
  }

  /**
   * Send an MCP notification (no response expected).
   */
  private async mcpNotify(method: string, params: unknown): Promise<void> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });

    await fetch(`${this.serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
  }

  private async httpGet(path: string): Promise<unknown> {
    const resp = await fetch(`${this.serverUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`);
    }

    return resp.json();
  }

  private async httpPost(path: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${this.serverUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`);
    }

    return resp.json();
  }
}
