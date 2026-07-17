#!/data/data/com.termux/files/usr/bin/node

// ==========================================
// Deepcode CLI v0.2.0
// ==========================================

import { parseArgs } from "util";
import { loadConfig, DEFAULT_CONFIG } from "../core/config/index.js";
import { ProviderRegistry } from "../core/provider/index.js";
import { AgentOrchestrator } from "../core/agent/index.js";
import { ToolRegistry } from "../tools/index.js";
import { registerBuiltinTools } from "../tools/register.js";
import { resolve } from "path";

const VERSION = "0.2.0";

// ==========================================
// Parse Args
// ==========================================

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    model: { type: "string", short: "m" },
    agent: { type: "string", short: "a" },
    tui: { type: "boolean", short: "t" },
    plain: { type: "boolean", short: "p" },
    "no-config": { type: "boolean" },
  },
  allowPositionals: true,
});

// ==========================================
// Help
// ==========================================

function showHelp() {
  console.log(`
\x1b[1;36m ______   _______  _______  _______  _______  _______  ______   _______
(  __  \\ (  ____ \\(  ____ \\(  ____ )(  ____ \\(  ___  )(  __  \\ (  ____ \\
| (  \\  )| (    \\/| (    \\/| (    )|| (    \\/| (   ) || (  \\  )| (    \\/
| |   ) || (__    | (__    | (____)|| |      | |   | || |   ) || (__    
| |   | ||  __)   |  __)   |  _____)| |      | |   | || |   | ||  __)   
| |   ) || (      | (      | (      | |      | |   | || |   ) || (      
| (__/  )| (____/\\| (____/\\| )      | (____/\\| (___) || (__/  )| (____/\\
(______/ (_______/(_______/|/       (_______/(_______)(______/ (_______/\x1b[0m
\x1b[2m  v${VERSION}  │  Agentic Coding Assistant for Termux\x1b[0m

\x1b[1mUsage:\x1b[0m
  deepcode [options] [message]

\x1b[1mOptions:\x1b[0m
  -h, --help           Show help
  -v, --version        Show version
  -m, --model <model>  Use specific model
  -a, --agent <agent>  Use specific agent (build, plan, explore, general)
  -t, --tui            Launch rich TUI (default when no args)
  -p, --plain          Use plain text mode
  --no-config          Skip loading config files

\x1b[1mExamples:\x1b[0m
  deepcode                    # Launch TUI
  deepcode "hello"            # Single message
  deepcode -p "fix main.ts"   # Plain mode
  deepcode -m openai/gpt-4o   # Specific model

\x1b[1mAgents:\x1b[0m
  build      Primary coding agent
  plan       Planning agent
  explore    Code exploration agent
  general    General purpose agent

\x1b[1mBYOP/BYOK/BYOM:\x1b[0m
  Configure custom providers in deepcode.json
`);
}

// ==========================================
// Init
// ==========================================

async function init(config: any) {
  const { parseProviderConfig } = await import("../core/config/provider-schema.js");
  const providerConfig = parseProviderConfig(config.provider);

  const providers = new ProviderRegistry({
    apiKeys: providerConfig.apiKeys,
    customProviders: providerConfig.customProviders,
  });

  for (const [alias, actual] of Object.entries(providerConfig.modelAliases)) {
    providers.registerModelAlias(alias, actual);
  }

  const tools = new ToolRegistry();
  const workDir = resolve(process.cwd());

  const orchestrator = new AgentOrchestrator({
    providers,
    tools,
    model: config.model || DEFAULT_CONFIG.model!,
    smallModel: config.small_model,
    workDir,
  });

  registerBuiltinTools(tools, orchestrator, providers);

  return { providers, tools, orchestrator };
}

// ==========================================
// Main
// ==========================================

async function main() {
  if (values.version) { console.log(`deepcode v${VERSION}`); return; }
  if (values.help) { showHelp(); return; }

  let config;
  if (values["no-config"]) {
    config = DEFAULT_CONFIG;
  } else {
    try { config = await loadConfig(); }
    catch { config = DEFAULT_CONFIG; }
  }

  if (values.model) config.model = values.model;

  const message = positionals.join(" ");
  const { providers, tools, orchestrator } = await init(config);

  if (message) {
    // Single message mode
    const sessionId = orchestrator.createSession(values.agent as string);
    const response = await orchestrator.processMessage(sessionId, message, { model: values.model });
    console.log(response);
  } else if (values.plain) {
    // Plain interactive mode
    await plainMode(orchestrator, values.agent as string);
  } else {
    // Rich TUI (default)
    const { DeepcodeTUI } = await import("../tui/app.js");
    const tui = new DeepcodeTUI({ providers, orchestrator, tools });
    await tui.start();
  }
}

// ==========================================
// Plain Mode
// ==========================================

async function plainMode(orchestrator: AgentOrchestrator, agentName?: string) {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\x1b[1;36mDeepcode v${VERSION} (plain mode)\x1b[0m`);
  console.log(`\x1b[2mType /help for commands, /quit to exit\x1b[0m\n`);

  const sessionId = orchestrator.createSession(agentName);

  const ask = () => {
    rl.question("\x1b[32m❯\x1b[0m ", async (input) => {
      const q = input.trim();
      if (!q) { ask(); return; }
      if (q === "/quit" || q === "/exit") { rl.close(); return; }
      if (q === "/help") {
        console.log("\n  /help, /quit, /clear, /model\n");
        ask(); return;
      }
      if (q === "/clear") { console.clear(); ask(); return; }

      try {
        const response = await orchestrator.processMessage(sessionId, q);
        console.log(`\n${response}\n`);
      } catch (e: any) {
        console.error(`\x1b[31mError: ${e.message}\x1b[0m\n`);
      }
      ask();
    });
  };

  ask();
}

main().catch((e) => { console.error(`\x1b[31mFatal: ${e.message}\x1b[0m`); process.exit(1); });
