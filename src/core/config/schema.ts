import { z } from "zod";

// ==========================================
// Provider Configuration
// ==========================================

const ProviderOptionsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

const ProviderConfigSchema = z.record(z.string(), ProviderOptionsSchema);

// ==========================================
// Agent Configuration
// ==========================================

const PermissionActionSchema = z.enum(["allow", "ask", "deny"]);

const ToolPermissionSchema = z.union([
  PermissionActionSchema,
  z.record(z.string(), PermissionActionSchema),
]);

const AgentConfigSchema = z.object({
  model: z.string().optional(),
  mode: z.enum(["primary", "subagent", "all"]).optional(),
  description: z.string().optional(),
  permission: z.record(ToolPermissionSchema).optional(),
  prompt: z.string().optional(),
  hidden: z.boolean().optional(),
  disable: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

// ==========================================
// MCP Configuration
// ==========================================

const LocalMCPServerSchema = z.object({
  type: z.literal("local"),
  command: z.array(z.string()),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const RemoteMCPServerSchema = z.object({
  type: z.literal("remote"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const MCPServerSchema = z.union([
  LocalMCPServerSchema,
  RemoteMCPServerSchema,
  z.object({ enabled: z.literal(false) }),
]);

// ==========================================
// Skills Configuration
// ==========================================

const SkillsConfigSchema = z.object({
  paths: z.array(z.string()).optional(),
  urls: z.array(z.string().url()).optional(),
});

// ==========================================
// References Configuration
// ==========================================

const LocalReferenceSchema = z.object({
  path: z.string(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
});

const GitReferenceSchema = z.object({
  repository: z.string(),
  branch: z.string().optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
});

const ReferenceSchema = z.union([LocalReferenceSchema, GitReferenceSchema]);

// ==========================================
// Plugin Configuration
// ==========================================

const PluginEntrySchema = z.union([
  z.string(),
  z.tuple([z.string(), z.record(z.unknown())]),
]);

// ==========================================
// Command Configuration
// ==========================================

const CommandConfigSchema = z.object({
  description: z.string().optional(),
  template: z.string().optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
});

// ==========================================
// Main Config Schema
// ==========================================

export const DeepcodeConfigSchema = z.object({
  $schema: z.string().url().optional(),
  username: z.string().optional(),
  model: z.string().optional(),
  small_model: z.string().optional(),
  default_agent: z.string().optional(),
  shell: z.string().optional(),
  logLevel: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional(),
  share: z.enum(["manual", "auto", "disabled"]).optional(),
  autoupdate: z.union([z.boolean(), z.literal("notify")]).optional(),
  snapshot: z.boolean().optional(),
  instructions: z.array(z.string()).optional(),

  skills: SkillsConfigSchema.optional(),
  references: z.record(ReferenceSchema).optional(),
  agent: z.record(AgentConfigSchema).optional(),
  command: z.record(CommandConfigSchema).optional(),
  provider: ProviderConfigSchema.optional(),
  disabled_providers: z.array(z.string()).optional(),
  enabled_providers: z.array(z.string()).optional(),
  mcp: z.record(MCPServerSchema).optional(),
  plugin: z.array(PluginEntrySchema).optional(),
  permission: z.record(ToolPermissionSchema).optional(),
  formatter: z.union([z.boolean(), z.record(z.unknown())]).optional(),
  lsp: z.union([z.boolean(), z.record(z.unknown())]).optional(),
  experimental: z
    .object({
      primary_tools: z.array(z.string()).optional(),
      mcp_timeout: z.number().optional(),
    })
    .optional(),
  tool_output: z
    .object({
      max_lines: z.number().optional(),
      max_bytes: z.number().optional(),
    })
    .optional(),
  compaction: z
    .object({
      auto: z.boolean().optional(),
      tail_turns: z.number().optional(),
    })
    .optional(),
});

export type DeepcodeConfig = z.infer<typeof DeepcodeConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type MCPServer = z.infer<typeof MCPServerSchema>;
