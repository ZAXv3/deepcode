import { Provider, ChatParams, ChatResponse, ChatStreamChunk, MessageContent } from "./types.js";

// ==========================================
// Google (Gemini) Provider
// ==========================================

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string } | { functionCall: { name: string; args: unknown } }>;
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

export class GoogleProvider extends Provider {
  readonly name = "google";
  readonly models = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro",
  ];

  private get apiKey(): string {
    if (!this.options.apiKey) {
      throw new Error("Google API key not configured. Set GOOGLE_API_KEY environment variable.");
    }
    return this.options.apiKey;
  }

  private get baseUrl(): string {
    return this.options.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  }

  private extractModelId(model: string): string {
    return model.split("/").pop() || model;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const modelId = this.extractModelId(params.model);
    
    const contents: GeminiContent[] = [];
    let systemInstruction = "";

    for (const msg of params.messages) {
      if (msg.role === "system") {
        systemInstruction = typeof msg.content === "string" ? msg.content : "";
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: typeof msg.content === "string" ? msg.content : this.convertContent(msg.content) }],
        });
      }
    }

    const body: Record<string, unknown> = {
      contents,
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (params.tools?.length) {
      body.tools = [{
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
    }

    const genConfig: Record<string, unknown> = {};
    if (params.temperature !== undefined) genConfig.temperature = params.temperature;
    if (params.maxTokens) genConfig.maxOutputTokens = params.maxTokens;
    if (Object.keys(genConfig).length) body.generationConfig = genConfig;

    const response = await fetch(
      `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> };
        finishReason: string;
      }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
    };

    const candidate = data.candidates[0];
    const content: MessageContent[] = [];

    for (const part of candidate.content.parts) {
      if (part.text) {
        content.push({ type: "text", text: part.text });
      } else if (part.functionCall) {
        content.push({
          type: "tool_use",
          id: `call_${Date.now()}`,
          name: part.functionCall.name,
          input: part.functionCall.args as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
      stopReason: candidate.finishReason,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    // Google streaming implementation (non-streaming fallback)
    const response = await this.chat(params);
    for (const item of response.content) {
      if (item.type === "text") {
        yield { type: "text", text: item.text };
      } else if (item.type === "tool_use") {
        yield { type: "tool_use", toolCall: item };
      }
    }
    yield { type: "done" };
  }

  private convertContent(content: MessageContent[]): string {
    return content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
  }
}
