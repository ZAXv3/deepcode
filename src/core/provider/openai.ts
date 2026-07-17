import { Provider, ChatParams, ChatResponse, ChatStreamChunk, MessageContent } from "./types.js";

// ==========================================
// OpenAI Provider
// ==========================================

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; [key: string]: unknown }> | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OpenAIProvider extends Provider {
  readonly name = "openai";
  readonly models = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1",
    "o1-mini",
    "o1-pro",
  ];

  private get apiKey(): string {
    if (!this.options.apiKey) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
    }
    return this.options.apiKey;
  }

  private get baseUrl(): string {
    return this.options.baseUrl || "https://api.openai.com/v1";
  }

  private extractModelId(model: string): string {
    return model.split("/").pop() || model;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const modelId = this.extractModelId(params.model);
    
    const messages: OpenAIMessage[] = params.messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: typeof m.content === "string" ? m.content : this.convertContent(m.content),
    }));

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    const content: MessageContent[] = [];

    if (choice.message.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice.message.tool_calls) {
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
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
      stopReason: choice.finish_reason,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    const modelId = this.extractModelId(params.model);
    
    const messages: OpenAIMessage[] = params.messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: typeof m.content === "string" ? m.content : this.convertContent(m.content),
    }));

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
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
            const delta = event.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text", text: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.arguments) {
                  yield {
                    type: "tool_use",
                    toolCall: {
                      type: "tool_use",
                      id: tc.id || "",
                      name: tc.function.name || "",
                      input: JSON.parse(tc.function.arguments || "{}"),
                    },
                  };
                }
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    yield { type: "done" };
  }

  private convertContent(content: MessageContent[]): string {
    return content
      .map((c) => {
        if (c.type === "text") return c.text;
        return "";
      })
      .join("");
  }
}
