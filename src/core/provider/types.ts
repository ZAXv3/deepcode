// ==========================================
// Message Types
// ==========================================

export type Role = "system" | "user" | "assistant" | "tool";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolCallContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageContent = TextContent | ToolCallContent | ToolResultContent;

export interface Message {
  role: Role;
  content: string | MessageContent[];
}

// ==========================================
// Tool Definitions
// ==========================================

export interface ToolParameter {
  type: string;
  description?: string;
  required?: boolean;
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

// ==========================================
// Provider Interface
// ==========================================

export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatParams {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: MessageContent[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
}

export interface ChatStreamChunk {
  type: "text" | "tool_use" | "done";
  text?: string;
  toolCall?: ToolCallContent;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export abstract class Provider {
  protected options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  abstract readonly name: string;
  abstract readonly models: string[];

  abstract chat(params: ChatParams): Promise<ChatResponse>;
  abstract chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk>;

  supportsModel(model: string): boolean {
    return this.models.some((m) => model.startsWith(m));
  }
}
