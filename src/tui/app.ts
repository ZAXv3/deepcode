// ==========================================
// Deepcode TUI v2 - Modern Terminal Interface
// ==========================================

import { c, clear, hideCursor, showCursor, banner, box, menu, prompt, statusLine, Spinner, StreamDisplay, onKey, sleep } from "./core.js";
import { ProviderRegistry } from "../core/provider/index.js";
import { AgentOrchestrator, AgentSession } from "../core/agent/orchestrator.js";
import { ToolRegistry } from "../tools/index.js";

export interface TUIConfig {
  providers: ProviderRegistry;
  orchestrator: AgentOrchestrator;
  tools: ToolRegistry;
}

export class DeepcodeTUI {
  private providers: ProviderRegistry;
  private orchestrator: AgentOrchestrator;
  private tools: ToolRegistry;
  private model: string;
  private agent: string;
  private session: AgentSession | null = null;
  private totalTokens = 0;

  constructor(config: TUIConfig) {
    this.providers = config.providers;
    this.orchestrator = config.orchestrator;
    this.tools = config.tools;
    this.model = "anthropic/claude-sonnet-4-6";
    this.agent = "build";
  }

  // ==========================================
  // Main Entry
  // ==========================================

  async start() {
    clear();
    console.log(banner());
    console.log(`${c.dim}  v0.2.0  │  Agentic Coding Assistant for Termux${c.reset}\n`);

    // Show quick status
    const providers = this.providers.listProviders();
    const tools = this.tools.list().length;
    console.log(statusLine([
      { label: "Providers", value: providers.length ? providers.join(", ") : "none", color: c.green },
      { label: "Tools", value: `${tools}`, color: c.cyan },
      { label: "Model", value: this.model, color: c.yellow },
    ]));
    console.log();

    // Check if we have API keys configured
    if (providers.length === 0) {
      console.log(`  ${c.yellow}⚠  No API keys configured. Set ANTHROPIC_API_KEY or use settings.${c.reset}\n`);
    }

    await this.mainLoop();
  }

  // ==========================================
  // Main Loop
  // ==========================================

  private async mainLoop() {
    while (true) {
      const action = await menu({
        title: "deepcode",
        items: [
          { label: "Chat", value: "chat", icon: "💬", desc: "Start a conversation with an AI agent", color: c.green },
          { label: "Models", value: "models", icon: "🧠", desc: "Select or discover available models", color: c.cyan },
          { label: "Agents", value: "agents", icon: "🤖", desc: "Choose an agent persona", color: c.magenta },
          { label: "Tools", value: "tools", icon: "🔧", desc: "View available tools", color: c.yellow },
          { label: "Settings", value: "settings", icon: "⚙️", desc: "Configure API keys and preferences", color: c.blue },
          { label: "Exit", value: "exit", icon: "👋", desc: "Quit Deepcode", color: c.red },
        ],
      });

      if (action === "__back__" || action === "exit") {
        clear();
        console.log(`\n  ${c.dim}Goodbye!${c.reset}\n`);
        return;
      }

      switch (action) {
        case "chat": await this.chatSession(); break;
        case "models": await this.modelsMenu(); break;
        case "agents": await this.agentsMenu(); break;
        case "tools": await this.toolsMenu(); break;
        case "settings": await this.settingsMenu(); break;
      }
    }
  }

  // ==========================================
  // Chat Session
  // ==========================================

  private async chatSession() {
    clear();

    // Create session
    const spin = new Spinner("Initializing session...");
    spin.start();
    const sessionId = this.orchestrator.createSession(this.agent);
    this.session = this.orchestrator.getSession(sessionId)!;
    await sleep(300);
    spin.stop("Ready");

    // Header
    console.log(`\n  ${c.bold}Chat${c.reset}  ${c.dim}│${c.reset}  Model: ${c.cyan}${this.model}${c.reset}  ${c.dim}│${c.reset}  Agent: ${c.magenta}${this.agent}${c.reset}`);
    console.log(`  ${c.dim}Type your message, /help for commands, /back to return${c.reset}\n`);

    // Chat loop
    while (true) {
      const input = await prompt({ color: c.green });

      if (!input) continue;

      // Handle commands
      if (input.startsWith("/")) {
        const cmd = input.slice(1).split(" ")[0];
        switch (cmd) {
          case "back":
          case "exit":
          case "q":
            return;
          case "help":
            this.showChatHelp();
            continue;
          case "clear":
            clear();
            console.log(`  ${c.dim}Chat cleared${c.reset}\n`);
            continue;
          case "model":
            console.log(`  ${c.dim}Current model: ${this.model}${c.reset}`);
            continue;
          case "agent":
            console.log(`  ${c.dim}Current agent: ${this.agent}${c.reset}`);
            continue;
        }
        console.log(`  ${c.red}Unknown command: /${cmd}${c.reset}`);
        continue;
      }

      // Process message
      await this.processMessage(input);
    }
  }

  private async processMessage(input: string) {
    const spin = new Spinner("Thinking...");
    spin.start();

    try {
      // Simulate processing delay for UX
      await sleep(400);

      const response = await this.orchestrator.processMessage(
        this.session!.id,
        input,
        { model: this.model }
      );

      spin.stop();

      // Stream the response
      const display = new StreamDisplay();
      display.start();

      const words = response.split(" ");
      for (const word of words) {
        display.append(word + " ");
        await sleep(15 + Math.random() * 15);
      }

      display.finish();
      console.log();
    } catch (error: any) {
      spin.fail(`Error: ${error.message || String(error)}`);
    }
  }

  private showChatHelp() {
    console.log(`
  ${c.bold}Commands:${c.reset}
    ${c.cyan}/help${c.reset}       Show this help
    ${c.cyan}/back${c.reset}       Return to main menu
    ${c.cyan}/clear${c.reset}      Clear screen
    ${c.cyan}/model${c.reset}      Show current model
    ${c.cyan}/agent${c.reset}      Show current agent
`);
  }

  // ==========================================
  // Models Menu
  // ==========================================

  private async modelsMenu() {
    const models = this.providers.listModels();

    const items = models.map((m) => ({
      label: m.fullId,
      value: m.fullId,
      icon: "🧠",
      color: c.cyan,
    }));

    // Add test option
    items.push({ label: "Test Provider Connection", value: "__test__", icon: "🔍", color: c.yellow });

    if (items.length === 0) {
      clear();
      console.log(`\n  ${c.yellow}⚠  No models available. Configure API keys in settings.${c.reset}\n`);
      await prompt({});
      return;
    }

    const action = await menu({ title: "Select Model", items });

    if (action === "__test__") {
      await this.testProviders();
    } else if (action !== "__back__") {
      this.model = action;
      clear();
      console.log(`\n  ${c.green}✓${c.reset} Model set to ${c.cyan}${action}${c.reset}\n`);
      await sleep(800);
    }
  }

  // ==========================================
  // Test Provider Connection
  // ==========================================

  private async testProviders() {
    clear();
    console.log(`\n  ${c.bold}Testing Provider Connections${c.reset}\n`);

    const providers = this.providers.listProviders();

    for (const provider of providers) {
      const spin = new Spinner(`Testing ${provider}...`);
      spin.start();

      try {
        // Try a minimal chat request
        const models = this.providers.listModels().filter((m) => m.provider === provider);
        if (models.length === 0) {
          spin.fail(`${provider}: No models registered`);
          continue;
        }

        await this.providers.chat({
          model: models[0].fullId,
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 5,
        });

        spin.stop(`${provider}: ${c.green}Connected${c.reset}`);
      } catch (error: any) {
        spin.fail(`${provider}: ${c.red}${error.message || "Failed"}${c.reset}`);
      }
    }

    console.log();
    await prompt({});
  }

  // ==========================================
  // Agents Menu
  // ==========================================

  private async agentsMenu() {
    const agents = this.orchestrator.listAgents();

    const action = await menu({
      title: "Select Agent",
      items: agents.map((a) => ({
        label: a.name,
        value: a.name,
        icon: "🤖",
        desc: a.description,
        color: c.magenta,
      })),
    });

    if (action !== "__back__") {
      this.agent = action;
      clear();
      console.log(`\n  ${c.green}✓${c.reset} Agent set to ${c.magenta}${action}${c.reset}\n`);
      await sleep(800);
    }
  }

  // ==========================================
  // Tools Menu
  // ==========================================

  private async toolsMenu() {
    clear();
    const tools = this.tools.list();

    const lines = tools.map((t) => `  ${c.green}✓${c.reset}  ${c.bold}${t.definition.name}${c.reset}  ${c.dim}${t.definition.description}${c.reset}`);

    console.log(box(lines, { title: `${tools.length} Tools Available`, color: c.green }));
    console.log();

    await prompt({});
  }

  // ==========================================
  // Settings Menu
  // ==========================================

  private async settingsMenu() {
    const action = await menu({
      title: "Settings",
      items: [
        { label: "Set API Keys", value: "keys", icon: "🔑", desc: "Configure provider API keys", color: c.yellow },
        { label: `Default Model: ${this.model}`, value: "model", icon: "🧠", desc: "Change the default model", color: c.cyan },
        { label: `Default Agent: ${this.agent}`, value: "agent", icon: "🤖", desc: "Change the default agent", color: c.magenta },
        { label: "Back", value: "__back__", icon: "←", color: c.dim },
      ],
    });

    if (action === "keys") {
      await this.configureKeys();
    } else if (action === "model") {
      await this.modelsMenu();
    } else if (action === "agent") {
      await this.agentsMenu();
    }
  }

  private async configureKeys() {
    clear();
    console.log(`\n  ${c.bold}Configure API Keys${c.reset}\n`);
    console.log(`  ${c.dim}Press Enter to skip a provider${c.reset}\n`);

    const providers = ["anthropic", "openai", "google"];

    for (const provider of providers) {
      const key = await prompt({ placeholder: `${provider} API key (Enter to skip)`, color: c.yellow });
      if (key) {
        this.providers.setApiKey(provider, key);
        console.log(`  ${c.green}✓${c.reset} ${provider} key saved\n`);
      }
    }

    console.log(`\n  ${c.dim}Restart Deepcode for changes to take effect${c.reset}`);
    await sleep(1500);
  }
}
