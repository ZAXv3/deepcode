import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { DeepcodeConfig, DeepcodeConfigSchema } from "./schema.js";

// ==========================================
// Config Paths
// ==========================================

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const PREFIX = process.env.PREFIX || "";

export const CONFIG_PATHS = {
  // Project-level config (walk up from cwd)
  project: [
    join(process.cwd(), "deepcode.json"),
    join(process.cwd(), "deepcode.jsonc"),
    join(process.cwd(), ".deepcode", "deepcode.json"),
  ],
  // Global config
  global: join(HOME, ".config", "deepcode", "deepcode.json"),
  // Termux-specific config
  termux: join(PREFIX, "etc", "deepcode", "deepcode.json"),
};

// ==========================================
// Config Loading
// ==========================================

async function loadJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    if (!existsSync(path)) return null;
    const content = await readFile(path, "utf-8");
    // Strip JSON comments (simple approach)
    const stripped = content
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,\s*([\]}])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export async function loadConfig(options?: {
  projectDir?: string;
  skipProject?: boolean;
  skipGlobal?: boolean;
}): Promise<DeepcodeConfig> {
  let merged: Record<string, unknown> = {};

  // 1. Load global config
  if (!options?.skipGlobal) {
    const globalConfig = await loadJsonFile(CONFIG_PATHS.global);
    if (globalConfig) {
      merged = deepMerge(merged, globalConfig);
    }
  }

  // 2. Load Termux-specific config
  const termuxConfig = await loadJsonFile(CONFIG_PATHS.termux);
  if (termuxConfig) {
    merged = deepMerge(merged, termuxConfig);
  }

  // 3. Load project config (overrides global)
  if (!options?.skipProject) {
    for (const configPath of CONFIG_PATHS.project) {
      const projectConfig = await loadJsonFile(configPath);
      if (projectConfig) {
        merged = deepMerge(merged, projectConfig);
        break; // Use first found project config
      }
    }
  }

  // 4. Apply environment variable overrides
  merged = applyEnvOverrides(merged);

  // 5. Validate and return
  const result = DeepcodeConfigSchema.safeParse(merged);
  if (!result.success) {
    console.error("Configuration validation errors:");
    for (const error of result.error.errors) {
      console.error(`  ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

// ==========================================
// Environment Variable Overrides
// ==========================================

function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };

  // DEEPCODE_MODEL -> model
  if (process.env.DEEPCODE_MODEL) {
    result.model = process.env.DEEPCODE_MODEL;
  }

  // DEEPCODE_LOG_LEVEL -> logLevel
  if (process.env.DEEPCODE_LOG_LEVEL) {
    result.logLevel = process.env.DEEPCODE_LOG_LEVEL;
  }

  // DEEPCODE_SHELL -> shell
  if (process.env.DEEPCODE_SHELL) {
    result.shell = process.env.DEEPCODE_SHELL;
  }

  // Provider API keys from env
  if (process.env.ANTHROPIC_API_KEY) {
    if (!result.provider) result.provider = {};
    if (!(result.provider as Record<string, unknown>).anthropic) {
      (result.provider as Record<string, unknown>).anthropic = {};
    }
    ((result.provider as Record<string, unknown>).anthropic as Record<string, unknown>).apiKey =
      process.env.ANTHROPIC_API_KEY;
  }

  if (process.env.OPENAI_API_KEY) {
    if (!result.provider) result.provider = {};
    if (!(result.provider as Record<string, unknown>).openai) {
      (result.provider as Record<string, unknown>).openai = {};
    }
    ((result.provider as Record<string, unknown>).openai as Record<string, unknown>).apiKey =
      process.env.OPENAI_API_KEY;
  }

  if (process.env.GOOGLE_API_KEY) {
    if (!result.provider) result.provider = {};
    if (!(result.provider as Record<string, unknown>).google) {
      (result.provider as Record<string, unknown>).google = {};
    }
    ((result.provider as Record<string, unknown>).google as Record<string, unknown>).apiKey =
      process.env.GOOGLE_API_KEY;
  }

  return result;
}

// ==========================================
// Config Saving
// ==========================================

export async function saveConfig(
  config: DeepcodeConfig,
  path?: string
): Promise<void> {
  const savePath = path || CONFIG_PATHS.global;
  const dir = dirname(savePath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(savePath, JSON.stringify(config, null, 2), "utf-8");
}

// ==========================================
// Config Defaults
// ==========================================

export const DEFAULT_CONFIG: DeepcodeConfig = {
  model: "anthropic/claude-sonnet-4-6",
  small_model: "anthropic/claude-3-haiku",
  default_agent: "build",
  shell: `${process.env.PREFIX || ""}/bin/bash`,
  logLevel: "INFO",
  share: "disabled",
  autoupdate: false,
  snapshot: true,
  permission: {
    edit: "ask",
    bash: {
      "git *": "allow",
      "rm *": "deny",
      "*": "ask",
    },
  },
};
