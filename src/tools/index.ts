// ==========================================
// Tool Base Class
// ==========================================

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolResult {
  output: string;
  error?: string;
}

export abstract class Tool {
  abstract readonly definition: ToolDefinition;

  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;
}

// ==========================================
// Tool Registry
// ==========================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.list().map((t) => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: "", error: `Unknown tool: ${name}` };
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      return {
        output: "",
        error: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
