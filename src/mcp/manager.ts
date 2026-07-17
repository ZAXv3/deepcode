import { MCPClient, MCPServerConfig, MCPTool } from "./client/index.js";
import { Tool, ToolDefinition, ToolRegistry, ToolResult } from "../tools/index.js";

// ==========================================
// MCP Tool Wrapper
// ==========================================

class MCPToolWrapper extends Tool {
  private client: MCPClient;
  private mcpTool: MCPTool;

  constructor(client: MCPClient, mcpTool: MCPTool) {
    super();
    this.client = client;
    this.mcpTool = mcpTool;
  }

  readonly definition: ToolDefinition = {
    name: "",
    description: "",
    parameters: { type: "object", properties: {} },
  };

  get toolDefinition(): ToolDefinition {
    return {
      name: `mcp_${this.client.getName()}_${this.mcpTool.name}`,
      description: `[MCP: ${this.client.getName()}] ${this.mcpTool.description}`,
      parameters: this.mcpTool.inputSchema as ToolDefinition["parameters"],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await this.client.callTool(this.mcpTool.name, args);
      return {
        output: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        output: "",
        error: `MCP tool error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ==========================================
// MCP Manager
// ==========================================

export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    if (config.enabled === false) return;

    const client = new MCPClient(config);
    
    try {
      await client.connect();
      this.clients.set(config.name, client);

      // Register MCP tools
      const tools = await client.listTools();
      for (const tool of tools) {
        const wrapper = new MCPToolWrapper(client, tool);
        // Override definition getter
        Object.defineProperty(wrapper, "definition", {
          get: () => wrapper.toolDefinition,
        });
        this.toolRegistry.register(wrapper);
      }

      console.log(`[MCP] Connected to ${config.name} (${tools.length} tools)`);
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${config.name}:`, error);
    }
  }

  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  listServers(): string[] {
    return Array.from(this.clients.keys());
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}
