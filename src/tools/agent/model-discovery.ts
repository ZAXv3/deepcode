import { Tool, ToolDefinition, ToolResult } from "../index.js";
import { ProviderRegistry } from "../../core/provider/index.js";

// ==========================================
// Model Discovery Tool
// ==========================================

export class ModelDiscoveryTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "list_models",
    description: "List available models from all configured providers. Auto-discovers models from API responses.",
    parameters: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          description: "Filter by provider name (e.g., 'anthropic', 'openai'). Leave empty for all.",
        },
        search: {
          type: "string",
          description: "Search/filter models by name.",
        },
      },
    },
  };

  // Store provider registry reference
  providers: ProviderRegistry | null = null;

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.providers) {
      return { output: "", error: "Provider registry not connected" };
    }

    const providerFilter = args.provider as string | undefined;
    const search = args.search as string | undefined;

    let models = this.providers.listModels();

    // Apply filters
    if (providerFilter) {
      models = models.filter((m) => m.provider === providerFilter);
    }

    if (search) {
      const lower = search.toLowerCase();
      models = models.filter((m) => m.fullId.toLowerCase().includes(lower));
    }

    if (models.length === 0) {
      return {
        output: search || providerFilter
          ? `No models found matching filters: provider=${providerFilter || "all"}, search=${search || "none"}`
          : "No models available. Configure API keys to discover models.",
      };
    }

    // Group by provider
    const grouped: Record<string, typeof models> = {};
    for (const model of models) {
      if (!grouped[model.provider]) grouped[model.provider] = [];
      grouped[model.provider].push(model);
    }

    const lines: string[] = [];
    for (const [provider, providerModels] of Object.entries(grouped)) {
      lines.push(`\n\x1b[1m${provider}:\x1b[0m`);
      for (const model of providerModels) {
        const active = model.fullId === "anthropic/claude-sonnet-4-6" ? " \x1b[32m(active)\x1b[0m" : "";
        lines.push(`  \x1b[36m${model.fullId}\x1b[0m${active}`);
      }
    }

    return {
      output: `Available models (${models.length} total):\n${lines.join("\n")}`,
    };
  }
}
