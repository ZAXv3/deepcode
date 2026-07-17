import { Provider, ChatParams, ChatResponse, ChatStreamChunk, MessageContent } from "./types.js";

// ==========================================
// Anthropic Provider
// ==========================================

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class AnthropicProvider extends Provider {
  readonly name = "anthropic";
  readonly models = [
    "claude-sonnet-4-6",
    "claude-3-5-sonnet",
    "claude-3-5-haiku",
    "claude-3-opus",
    "claude-3-haiku",
  ];

  private get apiKey(): string {
    if (!this.options.apiKey) {
      throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");
    }
    return this.options.apiKey;
  }

  private get baseUrl(): string {
    return this.options.baseUrl || "https://api.anthropic.com";
  }

  private extractModelId(model: string): string {
    // Handle "anthropic/claude-sonnet-4-6" -> "claude-sonnet-4-6"
    return model.split("/").pop() || model;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const modelId = this.extractModelId(params.model);
    
    const messages: AnthropicMessage[] = [];
    let systemPrompt = "";

    // Convert messages
    for (const msg of params.messages) {
      if (msg.role === "system") {
        systemPrompt = typeof msg.content === "string" ? msg.content : "";
      } else if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : this.convertContent(msg.content),
        });
      }
    }

    // Build request body
    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: params.maxTokens || this.options.maxTokens || 4096,
      messages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    } else if (this.options.temperature !== undefined) {
      body.temperature = this.options.temperature;
    }

    // Make API call
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    // Convert response
    const content: MessageContent[] = data.content.map((c) => {
      if (c.type === "text") {
        return { type: "text", text: c.text || "" };
      } else if (c.type === "tool_use") {
        return {
          type: "tool_use",
          id: c.id || "",
          name: c.name || "",
          input: c.input || {},
        };
      }
      return { type: "text", text: "" };
    });

    return {
      content,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      stopReason: data.stop_reason,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    const modelId = this.extractModelId(params.model);
    
    const messages: AnthropicMessage[] = [];
    let systemPrompt = "";

    for (const msg of params.messages) {
      if (msg.role === "system") {
        systemPrompt = typeof msg.content === "string" ? msg.content : "";
      } else if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : this.convertContent(msg.content),
        });
      }
    }

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: params.maxTokens || this.options.maxTokens || 4096,
      messages,
      stream: true,
    };

    if (systemPrompt) body.system = systemPrompt;
    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }
    if (params.temperature !== undefined) body.temperature = params.temperature;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }

          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_start") {
              if (event.content_block?.type === "tool_use") {
                // Tool use started
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta?.type === "text_delta") {
                yield { type: "text", text: event.delta.text };
              }
            } else if (event.type === "message_stop") {
              yield { type: "done" };
              return;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    yield { type: "done" };
  }

  private convertContent(content: MessageContent[]): string | Array<{ type: string; [key: string]: unknown }> {
    return content.map((c) => {
      if (c.type === "text") return { type: "text", text: c.text };
      if (c.type === "tool_use") return { type: "tool_use", id: c.id, name: c.name, input: c.input };
      if (c.type === "tool_result") return { type: "tool_result", tool_use_id: c.tool_use_id, content: c.content };
      return { type: "text", text: "" };
    });
  }
}
