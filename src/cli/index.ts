#!/data/data/com.termux/files/usr/bin/node

// ==========================================
// Deepcode CLI Entry Point
// ==========================================

import { parseArgs } from "util";
import { loadConfig, DEFAULT_CONFIG } from "../core/config/index.js";
import { ProviderRegistry } from "../core/provider/index.js";
import { AgentOrchestrator } from "../core/agent/index.js";
import { ToolRegistry } from "../tools/index.js";
import { registerBuiltinTools } from "../tools/register.js";
import { logger } from "../core/logger.js";
import { resolve } from "path";

// ==========================================
// Version
// ==========================================

const VERSION = "0.2.0";

// ==========================================
// CLI Arguments
// ==========================================

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    model: { type: "string", short: "m" },
    agent: { type: "string", short: "a" },
    config: { type: "string", short: "c" },
    debug: { type: "boolean", short: "d" },
    "no-config": { type: "boolean" },
    tui: { type: "boolean", short: "t" },
    plain: { type: "boolean", short: "p" },
  },
  allowPositionals: true,
});

// ==========================================
// Help Text
// ==========================================

function showHelp(): void {
  console.log(`
\x1b[1;36m ______   _______  _______  _______  _______  _______  ______   _______
(  __  \\ (  ____ \\(  ____ \\(  ____ )(  ____ \\(  ___  )(  __  \\ (  ____ \\
| (  \\  )| (    \\/| (    \\/| (    )|| (    \\/| (   ) || (  \\  )| (    \\/
| |   ) || (__    | (__    | (____)|| |      | |   | || |   ) || (__    
| |   | ||  __)   |  __)   |  _____)| |      | |   | || |   | ||  __)   
| |   ) || (      | (      | (      | |      | |   | || |   ) || (      
| (__/  )| (____/\\| (____/\\| )      | (____/\\| (___) || (__/  )| (____/\\
(______/ (_______/(_______/|/       (_______/(_______)(______/ (_______/\x1b[0m
\x1b[2m                  Agentic Coding Assistant for Termux v${VERSION}\x1b[0m

\x1b[1mUsage:\x1b[0m
  deepcode [options] [message]

\x1b[1mOptions:\x1b[0m
  -h, --help           Show this help message
  -v, --version        Show version
  -m, --model <model>  Use specific model (e.g., anthropic/claude-sonnet-4-6)
  -a, --agent <agent>  Use specific agent (build, plan, general, explore)
  -c, --config <path>  Use specific config file
  -d, --debug          Enable debug logging
  --no-config          Skip loading config files
  -t, --tui            Launch rich TUI mode (default when no args)
  -p, --plain          Use plain text mode (no TUI)

\x1b[1mExamples:\x1b[0m
  deepcode "What does this code do?"
  deepcode -m openai/gpt-4o "Fix the bug in main.ts"
  deepcode -a plan "Design a REST API for users"
  deepcode -t                    # Launch rich TUI
  deepcode -p                    # Plain interactive mode
  deepcode                       # Launch rich TUI (default)

\x1b[1mBYOP/BYOK/BYOM:\x1b[0m
  Configure custom providers in deepcode.json:
  \x1b[2m{
    "provider": {
      "custom": [{
        "name": "my-local",
        "baseUrl": "http://localhost:11434/v1",
        "modelMap": { "llama3": "llama3:latest" }
      }],
      "aliases": {
        "local/llama3": "my-local/llama3"
      }
    }
  }\x1b[0m
`);
}

// ==========================================
// Initialize Infrastructure
// ==========================================

async function initInfrastructure(config: any) {
  // Initialize providers
  const { parseProviderConfig } = await import("../core/config/provider-schema.js");
  const providerConfig = parseProviderConfig(config.provider);
  
  const providers = new ProviderRegistry({
    apiKeys: providerConfig.apiKeys,
    customProviders: providerConfig.customProviders,
  });

  // Register model aliases
  for (const [alias, actual] of Object.entries(providerConfig.modelAliases)) {
    providers.registerModelAlias(alias, actual);
  }

  // Initialize tools
  const tools = new ToolRegistry();
  registerBuiltinTools(tools);

  // Get working directory
  const workDir = resolve(process.cwd());

  // Initialize orchestrator
  const orchestrator = new AgentOrchestrator({
    providers,
    tools,
    model: config.model || DEFAULT_CONFIG.model!,
    smallModel: config.small_model,
    workDir,
  });

  return { providers, tools, orchestrator };
}

// ==========================================
// Main Entry
// ==========================================

async function main(): Promise<void> {
  // Handle version
  if (values.version) {
    console.log(`deepcode v${VERSION}`);
    process.exit(0);
  }

  // Handle help
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // Set log level
  if (values.debug) {
    logger.setLevel("DEBUG");
  }

  // Load config
  let config;
  if (values["no-config"]) {
    config = DEFAULT_CONFIG;
  } else {
    try {
      config = await loadConfig({
        skipProject: false,
        skipGlobal: false,
      });
    } catch (error) {
      logger.error("Failed to load config:", error);
      process.exit(1);
    }
  }

  // Override model from CLI
  if (values.model) {
    config.model = values.model;
  }

  // Get message from args
  const message = positionals.join(" ");

  if (message) {
    // Single message mode
    const { providers, tools, orchestrator } = await initInfrastructure(config);
    const sessionId = orchestrator.createSession(values.agent as string);
    
    try {
      const response = await orchestrator.processMessage(sessionId, message, {
        model: values.model,
      });
      console.log(response);
    } catch (error) {
      logger.error("Error:", error);
      process.exit(1);
    }
  } else if (values.plain) {
    // Plain interactive mode
    const { providers, tools, orchestrator } = await initInfrastructure(config);
    await startPlainInteractive(orchestrator, values.agent as string);
  } else {
    // Rich TUI mode (default)
    const { providers, tools, orchestrator } = await initInfrastructure(config);
    await startTUI(providers, orchestrator, tools);
  }
}

// ==========================================
// Rich TUI Mode
// ==========================================

async function startTUI(
  providers: ProviderRegistry,
  orchestrator: AgentOrchestrator,
  tools: ToolRegistry
): Promise<void> {
  const { DeepcodeTUI } = await import("../tui/app.js");
  
  const tui = new DeepcodeTUI({
    providers,
    orchestrator,
    tools,
  });

  await tui.start();
}

// ==========================================
// Plain Interactive Mode (fallback)
// ==========================================

async function startPlainInteractive(
  orchestrator: AgentOrchestrator,
  agentName?: string
): Promise<void> {
  const readline = await import("readline");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[36mdeepcode>\x1b[0m ",
  });

  console.log(`
\x1b[1;36m╔══════════════════════════════════════════════════════════════╗
║                  Deepcode Interactive Mode                  ║
║          Type your message and press Enter                 ║
║          Type /help for commands, /quit to exit            ║
╚══════════════════════════════════════════════════════════════╝\x1b[0m
`);

  const sessionId = orchestrator.createSession(agentName);
  let running = true;

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith("/")) {
      const [cmd, ...args] = input.slice(1).split(" ");
      
      switch (cmd) {
        case "quit":
        case "exit":
          running = false;
          console.log("\x1b[33mGoodbye!\x1b[0m");
          rl.close();
          process.exit(0);
          break;
        case "help":
          showPlainHelp();
          break;
        case "clear":
          console.clear();
          break;
        case "model":
          if (args[0]) {
            console.log(`\x1b[32mSwitched to model: ${args[0]}\x1b[0m`);
          } else {
            console.log(`\x1b[33mCurrent model: ${orchestrator["model"]}\x1b[0m`);
          }
          break;
        default:
          console.log(`\x1b[31mUnknown command: ${cmd}\x1b[0m`);
      }
      
      if (running) rl.prompt();
      return;
    }

    // Process message
    try {
      process.stdout.write("\n");
      const response = await orchestrator.processMessage(sessionId, input);
      console.log(`\n${response}\n`);
    } catch (error) {
      console.error(`\x1b[31mError: ${error}\x1b[0m`);
    }
    
    rl.prompt();
  });

  rl.on("close", () => {
    if (running) {
      process.exit(0);
    }
  });
}

function showPlainHelp(): void {
  console.log(`
Commands:
  /help          Show this help
  /quit, /exit   Exit interactive mode
  /clear         Clear screen
  /model [name]  Show or switch model
  
Just type your message to chat with the AI assistant.
`);
}

// ==========================================
// Run
// ==========================================

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
