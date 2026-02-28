import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Secure API Key Storage
//
// Uses VS Code's SecretStorage API (backed by the OS keychain: macOS
// Keychain, Windows Credential Manager, or libsecret on Linux). The API
// key never touches disk in plaintext.
// ---------------------------------------------------------------------------

const API_KEY_KEY = 'airlancer.apiKey';
const SERVER_URL_KEY = 'airlancer.serverUrl';

export class SecretStorage {
  private storage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.storage = context.secrets;
  }

  async getApiKey(): Promise<string | undefined> {
    return this.storage.get(API_KEY_KEY);
  }

  async setApiKey(key: string): Promise<void> {
    await this.storage.store(API_KEY_KEY, key);
  }

  async deleteApiKey(): Promise<void> {
    await this.storage.delete(API_KEY_KEY);
  }

  async getServerUrl(): Promise<string | undefined> {
    return this.storage.get(SERVER_URL_KEY);
  }

  async setServerUrl(url: string): Promise<void> {
    await this.storage.store(SERVER_URL_KEY, url);
  }
}
