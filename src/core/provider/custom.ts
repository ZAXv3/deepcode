import { Provider, ChatParams, ChatResponse, ChatStreamChunk, MessageContent } from "./types.js";

// ==========================================
// BYOP - Bring Your Own Provider
// ==========================================

export interface CustomProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  // Model ID mapping - maps friendly names to API model IDs
  modelMap?: Record<string, string>;
  // Request body transformations
  requestTransform?: (body: Record<string, unknown>) => Record<string, unknown>;
  // Response body transformations
  responseTransform?: (response: unknown) => ChatResponse;
  // Streaming format: "openai" | "anthropic" | "custom"
  streamFormat?: "openai" | "anthropic" | "custom";
}

export class CustomProvider extends Provider {
  readonly name: string;
  readonly models: string[];
  private config: CustomProviderConfig;

  constructor(config: CustomProviderConfig) {
    super({ apiKey: config.apiKey, baseUrl: config.baseUrl });
    this.config = config;
    this.name = config.name;
    this.models = Object.keys(config.modelMap || {});
  }

  private resolveModelId(model: string): string {
    const friendlyName = model.split("/").pop() || model;
    return this.config.modelMap?.[friendlyName] || friendlyName;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const modelId = this.resolveModelId(params.model);

    // Build OpenAI-compatible request by default
    let body: Record<string, unknown> = {
      model: modelId,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : this.convertContent(m.content),
      })),
    };

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens) body.max_tokens = params.maxTokens;

    // Apply custom transform if provided
    if (this.config.requestTransform) {
      body = this.config.requestTransform(body);
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.config.name} API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Apply custom response transform if provided
    if (this.config.responseTransform) {
      return this.config.responseTransform(data);
    }

    // Default: assume OpenAI-compatible response
    return this.parseOpenAIResponse(data);
  }

  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    const modelId = this.resolveModelId(params.model);

    let body: Record<string, unknown> = {
      model: modelId,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : this.convertContent(m.content),
      })),
      stream: true,
    };

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }
    if (params.temperature !== undefined) body.temperature = params.temperature;

    if (this.config.requestTransform) {
      body = this.config.requestTransform(body);
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.config.name} API error: ${response.status} ${error}`);
    }

    // Handle different stream formats
    const format = this.config.streamFormat || "openai";
    
    if (format === "openai") {
      yield* this.streamOpenAI(response);
    } else if (format === "anthropic") {
      yield* this.streamAnthropic(response);
    } else {
      yield* this.streamOpenAI(response); // Default fallback
    }
  }

  private async *streamOpenAI(response: Response): AsyncGenerator<ChatStreamChunk> {
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
            const delta = event.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text", text: delta.content };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    yield { type: "done" };
  }

  private async *streamAnthropic(response: Response): AsyncGenerator<ChatStreamChunk> {
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
            if (event.type === "content_block_delta") {
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

  private parseOpenAIResponse(data: any): ChatResponse {
    const choice = data.choices?.[0];
    const content: MessageContent[] = [];

    if (choice?.message?.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      } : undefined,
      stopReason: choice?.finish_reason,
    };
  }

  private convertContent(content: MessageContent[]): string {
    return content.map((c) => (c.type === "text" ? c.text : "")).join("");
  }
}
