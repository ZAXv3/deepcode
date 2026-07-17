import { spawn, ChildProcess } from "child_process";

// ==========================================
// MCP Types
// ==========================================

export interface MCPServerConfig {
  name: string;
  type: "local" | "remote";
  command?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ==========================================
// MCP Client
// ==========================================

export class MCPClient {
  private server: MCPServerConfig;
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private connected = false;

  constructor(server: MCPServerConfig) {
    this.server = server;
  }

  // ==========================================
  // Connection Management
  // ==========================================

  async connect(): Promise<void> {
    if (this.server.type === "remote") {
      await this.connectRemote();
    } else {
      await this.connectLocal();
    }
    this.connected = true;
    await this.initialize();
  }

  private async connectLocal(): Promise<void> {
    if (!this.server.command) {
      throw new Error("No command specified for local MCP server");
    }

    const [cmd, ...args] = this.server.command;
    
    this.process = spawn(cmd, args, {
      env: { ...process.env, ...this.server.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[MCP ${this.server.name}] stderr: ${data.toString()}`);
    });

    this.process.on("exit", (code) => {
      console.error(`[MCP ${this.server.name}] exited with code ${code}`);
      this.connected = false;
    });
  }

  private async connectRemote(): Promise<void> {
    // Remote servers use HTTP/SSE - simplified implementation
    if (!this.server.url) {
      throw new Error("No URL specified for remote MCP server");
    }
    // For now, we'll just mark as connected
    // Full implementation would use SSE for streaming
  }

  private async initialize(): Promise<void> {
    try {
      const result = await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: "deepcode",
          version: "0.1.0",
        },
      });

      // Store server capabilities
      if (result.tools) {
        this.tools = result.tools;
      }
      if (result.resources) {
        this.resources = result.resources;
      }
      if (result.prompts) {
        this.prompts = result.prompts;
      }

      // Send initialized notification
      await this.notification("notifications/initialized", {});
    } catch (error) {
      console.error(`[MCP ${this.server.name}] Initialization failed:`, error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }

  // ==========================================
  // Request/Response
  // ==========================================

  private async request(method: string, params: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });

      if (this.process?.stdin) {
        this.process.stdin.write(message + "\n");
      } else {
        reject(new Error("Not connected to MCP server"));
      }
    });
  }

  private async notification(method: string, params: Record<string, unknown>): Promise<void> {
    const message = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });

    if (this.process?.stdin) {
      this.process.stdin.write(message + "\n");
    }
  }

  private handleMessage(data: string): void {
    const lines = data.split("\n").filter((l) => l.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
        }
      } catch (error) {
        console.error(`[MCP ${this.server.name}] Failed to parse message:`, error);
      }
    }
  }

  // ==========================================
  // Tool Operations
  // ==========================================

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) return [];
    try {
      const result = await this.request("tools/list", {});
      return result.tools || [];
    } catch {
      return this.tools;
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    if (!this.connected) {
      throw new Error("Not connected to MCP server");
    }
    return this.request("tools/call", { name, arguments: args });
  }

  // ==========================================
  // Resource Operations
  // ==========================================

  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) return [];
    try {
      const result = await this.request("resources/list", {});
      return result.resources || [];
    } catch {
      return this.resources;
    }
  }

  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error("Not connected to MCP server");
    }
    return this.request("resources/read", { uri });
  }

  // ==========================================
  // Prompt Operations
  // ==========================================

  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.connected) return [];
    try {
      const result = await this.request("prompts/list", {});
      return result.prompts || [];
    } catch {
      return this.prompts;
    }
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<any> {
    if (!this.connected) {
      throw new Error("Not connected to MCP server");
    }
    return this.request("prompts/get", { name, arguments: args });
  }

  // ==========================================
  // Status
  // ==========================================

  isConnected(): boolean {
    return this.connected;
  }

  getName(): string {
    return this.server.name;
  }
}
