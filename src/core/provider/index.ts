import { Provider, ChatParams, ChatResponse, ChatStreamChunk } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GoogleProvider } from "./google.js";
import { CustomProvider, CustomProviderConfig } from "./custom.js";

// ==========================================
// Provider Registry
// ==========================================

export type ProviderName = string; // Allow any string for BYOP

const builtinProviderClasses: Record<string, new (opts: any) => Provider> = {
  anthropic: AnthropicProvider,
  openai: OpenAIProvider,
  google: GoogleProvider,
};

export interface ProviderRegistryConfig {
  apiKeys?: Record<string, string>;
  customProviders?: CustomProviderConfig[];
}

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private modelAliases: Map<string, string> = new Map();

  constructor(config?: ProviderRegistryConfig) {
    // Initialize built-in providers with API keys
    for (const [name, Cls] of Object.entries(builtinProviderClasses)) {
      const apiKey = config?.apiKeys?.[name];
      if (apiKey) {
        this.providers.set(name, new Cls({ apiKey }));
      }
    }

    // Initialize custom providers (BYOP)
    if (config?.customProviders) {
      for (const customConfig of config.customProviders) {
        this.registerCustomProvider(customConfig);
      }
    }
  }

  // ==========================================
  // BYOP - Bring Your Own Provider
  // ==========================================

  registerCustomProvider(config: CustomProviderConfig): void {
    const provider = new CustomProvider(config);
    this.providers.set(config.name, provider);
    
    // Register model aliases
    if (config.modelMap) {
      for (const [friendly, actual] of Object.entries(config.modelMap)) {
        this.modelAliases.set(`${config.name}/${friendly}`, `${config.name}/${actual}`);
      }
    }
  }

  // ==========================================
  // BYOK - Bring Your Own Key
  // ==========================================

  setApiKey(provider: string, apiKey: string): void {
    const existing = this.providers.get(provider);
    if (existing) {
      // Update existing provider's key
      (existing as any).options = { ...(existing as any).options, apiKey };
    } else {
      // Create new provider with just the key
      const Cls = builtinProviderClasses[provider];
      if (Cls) {
        this.providers.set(provider, new Cls({ apiKey }));
      }
    }
  }

  // ==========================================
  // BYOM - Bring Your Own Model
  // ==========================================

  registerModelAlias(alias: string, actualModel: string): void {
    this.modelAliases.set(alias, actualModel);
  }

  resolveModel(model: string): string {
    return this.modelAliases.get(model) || model;
  }

  // ==========================================
  // Provider Access
  // ==========================================

  getProvider(model: string): Provider {
    const resolvedModel = this.resolveModel(model);
    const parts = resolvedModel.split("/");
    const providerName = parts.length > 1 ? parts[0] : this.guessProvider(resolvedModel);

    if (!providerName || !this.providers.has(providerName)) {
      throw new Error(
        `No provider found for model "${model}". ` +
        `Available providers: ${Array.from(this.providers.keys()).join(", ") || "none"}. ` +
        `Set API keys in your config or use BYOP/BYOK to add custom providers.`
      );
    }

    return this.providers.get(providerName)!;
  }

  private guessProvider(model: string): string | null {
    if (model.startsWith("claude")) return "anthropic";
    if (model.startsWith("gpt") || model.startsWith("o1")) return "openai";
    if (model.startsWith("gemini")) return "google";
    return null;
  }

  // ==========================================
  // Chat Methods
  // ==========================================

  async chat(params: ChatParams): Promise<ChatResponse> {
    const provider = this.getProvider(params.model);
    return provider.chat(params);
  }

  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    const provider = this.getProvider(params.model);
    yield* provider.chatStream(params);
  }

  // ==========================================
  // Introspection
  // ==========================================

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  listModels(): Array<{ provider: string; model: string; fullId: string }> {
    const models: Array<{ provider: string; model: string; fullId: string }> = [];
    
    for (const [providerName, provider] of this.providers) {
      for (const model of provider.models) {
        models.push({
          provider: providerName,
          model,
          fullId: `${providerName}/${model}`,
        });
      }
    }
    
    return models;
  }
}
