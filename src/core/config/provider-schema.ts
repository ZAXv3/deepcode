import { z } from "zod";

// ==========================================
// Provider Configuration Schema (with BYOP/BYOK/BYOM)
// ==========================================

// BYOK - Bring Your Own Key
const ProviderOptionsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

// BYOP - Bring Your Own Provider
const CustomProviderSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  modelMap: z.record(z.string()).optional(),
  streamFormat: z.enum(["openai", "anthropic", "custom"]).optional(),
});

// BYOM - Bring Your Own Model (alias mapping)
const ModelAliasSchema = z.record(z.string(), z.string());

// Legacy format - direct provider configs
const LegacyProviderSchema = z.record(z.union([ProviderOptionsSchema, z.array(CustomProviderSchema)]));

export const ProviderConfigSchema = z.object({
  // Built-in provider configs (BYOK)
  builtin: z.record(ProviderOptionsSchema).optional(),
  
  // Custom providers (BYOP)
  custom: z.array(CustomProviderSchema).optional(),
  
  // Model aliases (BYOM)
  aliases: ModelAliasSchema.optional(),
  
  // Legacy format - direct provider configs
  legacy: LegacyProviderSchema.optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type CustomProviderConfig = z.infer<typeof CustomProviderSchema>;

// ==========================================
// Parse Provider Config
// ==========================================

export function parseProviderConfig(config: any): {
  apiKeys: Record<string, string>;
  customProviders: CustomProviderConfig[];
  modelAliases: Record<string, string>;
} {
  const apiKeys: Record<string, string> = {};
  const customProviders: CustomProviderConfig[] = [];
  const modelAliases: Record<string, string> = {};

  if (!config) return { apiKeys, customProviders, modelAliases };

  // Handle new structured format
  if (config.builtin) {
    for (const [provider, opts] of Object.entries(config.builtin)) {
      if (opts && typeof opts === "object" && "apiKey" in opts) {
        apiKeys[provider] = (opts as any).apiKey;
      }
    }
  }

  // Handle custom providers (BYOP)
  if (config.custom && Array.isArray(config.custom)) {
    customProviders.push(...config.custom);
  }

  // Handle model aliases (BYOM)
  if (config.aliases) {
    Object.assign(modelAliases, config.aliases);
  }

  // Handle legacy flat format: { anthropic: { apiKey: "..." }, openai: { ... } }
  if (config.legacy) {
    for (const [key, value] of Object.entries(config.legacy)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const opts = value as Record<string, unknown>;
        if ("apiKey" in opts) {
          apiKeys[key] = resolveEnvValue(opts.apiKey as string);
        }
        if ("baseUrl" in opts && "name" in opts) {
          customProviders.push(value as CustomProviderConfig);
        }
      }
    }
  }
  
  // Also handle direct flat format (top-level provider names)
  for (const [key, value] of Object.entries(config)) {
    if (key === "builtin" || key === "custom" || key === "aliases" || key === "legacy") continue;
    
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const opts = value as Record<string, unknown>;
      if ("apiKey" in opts) {
        apiKeys[key] = resolveEnvValue(opts.apiKey as string);
      }
      if ("baseUrl" in opts && "name" in opts) {
        customProviders.push(value as CustomProviderConfig);
      }
    }
  }

  // Also resolve env: in builtin keys
  for (const [key, value] of Object.entries(apiKeys)) {
    apiKeys[key] = resolveEnvValue(value);
  }

  return { apiKeys, customProviders, modelAliases };
}

// Resolve "env:VAR_NAME" or "env:VAR_NAME|default" syntax
function resolveEnvValue(value: string): string {
  if (!value.startsWith("env:")) return value;
  const varSpec = value.slice(4);
  const pipeIdx = varSpec.indexOf("|");
  if (pipeIdx === -1) {
    // env:VAR_NAME
    return process.env[varSpec] || "";
  }
  // env:VAR_NAME|default
  const varName = varSpec.slice(0, pipeIdx);
  const defaultVal = varSpec.slice(pipeIdx + 1);
  return process.env[varName] || defaultVal;
}
