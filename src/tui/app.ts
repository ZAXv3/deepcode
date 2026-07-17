import { Colors, Emojis, Spinner, ProgressBar, drawBox, drawLogo, drawStatusBar, InteractiveMenu, StreamingDisplay, clearScreen, prompt, confirm, sleep } from "./core.js";
import { ProviderRegistry } from "../core/provider/index.js";
import { AgentOrchestrator, AgentSession } from "../core/agent/orchestrator.js";
import { ToolRegistry } from "../tools/index.js";

// ==========================================
// Deepcode TUI
// ==========================================

export interface TUIConfig {
  providers: ProviderRegistry;
  orchestrator: AgentOrchestrator;
  tools: ToolRegistry;
}

export class DeepcodeTUI {
  private providers: ProviderRegistry;
  private orchestrator: AgentOrchestrator;
  private tools: ToolRegistry;
  private currentSession: AgentSession | null = null;
  private currentModel: string;
  private currentAgent: string;
  private isRunning = false;

  constructor(config: TUIConfig) {
    this.providers = config.providers;
    this.orchestrator = config.orchestrator;
    this.tools = config.tools;
    this.currentModel = "anthropic/claude-sonnet-4-6";
    this.currentAgent = "build";
  }

  // ==========================================
  // Main Menu
  // ==========================================

  async showMainMenu(): Promise<void> {
    clearScreen();
    console.log(drawLogo());

    while (this.isRunning) {
      const menu = new InteractiveMenu({
        title: `${Emojis.sparkles} Main Menu`,
        items: [
          {
            label: "Start Chat",
            value: "chat",
            icon: Emojis.brain,
            description: "Start a conversation with an AI agent",
            color: Colors.green,
          },
          {
            label: "Select Model",
            value: "model",
            icon: Emojis.gear,
            description: "Choose which AI model to use",
            color: Colors.cyan,
          },
          {
            label: "Select Agent",
            value: "agent",
            icon: Emojis.robot,
            description: "Choose an agent persona (build, plan, explore)",
            color: Colors.yellow,
          },
          {
            label: "View Tools",
            value: "tools",
            icon: Emojis.wrench,
            description: "See available tools and their status",
            color: Colors.magenta,
          },
          {
            label: "Settings",
            value: "settings",
            icon: Emojis.gear,
            description: "Configure Deepcode settings",
            color: Colors.blue,
          },
          {
            label: "Exit",
            value: "exit",
            icon: Emojis.door,
            description: "Quit Deepcode",
            color: Colors.red,
          },
        ],
        columns: 2,
      });

      const choice = await menu.show();

      switch (choice) {
        case "chat":
          await this.startChat();
          break;
        case "model":
          await this.selectModel();
          break;
        case "agent":
          await this.selectAgent();
          break;
        case "tools":
          await this.showTools();
          break;
        case "settings":
          await this.showSettings();
          break;
        case "exit":
          this.isRunning = false;
          clearScreen();
          console.log(`\n${Colors.cyan}${Emojis.wave} Goodbye!${Colors.reset}\n`);
          return;
      }
    }
  }

  // ==========================================
  // Chat Session
  // ==========================================

  async startChat(): Promise<void> {
    clearScreen();

    // Show chat header
    console.log(`\n${Colors.bold}${Colors.cyan}${Emojis.brain} Deepcode Chat${Colors.reset}`);
    console.log(`${Colors.dim}Model: ${this.currentModel} | Agent: ${this.currentAgent}${Colors.reset}`);
    console.log(`${Colors.dim}Type /help for commands, /quit to return to menu${Colors.reset}\n`);

    // Create session
    const spinner = new Spinner({ text: "Initializing session...", style: "dots" });
    spinner.start();
    const sessionId = this.orchestrator.createSession(this.currentAgent);
    this.currentSession = this.orchestrator.getSession(sessionId)!;
    await sleep(500);
    spinner.stop("Session ready!");

    // Chat loop
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(`${Colors.green}${Emojis.arrow}${Colors.reset} `, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    let running = true;
    while (running) {
      const input = await askQuestion();

      if (!input) continue;

      // Handle commands
      if (input.startsWith("/")) {
        const [cmd] = input.slice(1).split(" ");

        switch (cmd) {
          case "quit":
          case "exit":
          case "q":
            running = false;
            break;
          case "help":
            this.showChatHelp();
            break;
          case "clear":
            clearScreen();
            break;
          case "model":
            await this.selectModel();
            break;
          case "agent":
            await this.selectAgent();
            break;
          case "status":
            console.log(drawStatusBar({
              model: this.currentModel,
              agent: this.currentAgent,
              tokens: this.currentSession?.messages?.length || 0,
              session: sessionId,
            }));
            break;
          default:
            console.log(`${Colors.yellow}Unknown command: /${cmd}${Colors.reset}`);
        }
        continue;
      }

      // Process message with streaming
      await this.processWithStreaming(input);
    }

    rl.close();
  }

  private async processWithStreaming(message: string): Promise<void> {
    const spinner = new Spinner({
      text: "Thinking...",
      style: "brain",
      color: Colors.magenta,
    });

    spinner.start();

    try {
      // Simulate streaming delay
      await sleep(800);

      const response = await this.orchestrator.processMessage(
        this.currentSession!.id,
        message,
        { model: this.currentModel }
      );

      spinner.stop();

      // Display response with streaming effect
      await this.streamResponse(response);
    } catch (error) {
      spinner.fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async streamResponse(text: string): Promise<void> {
    const display = new StreamingDisplay();
    display.start();

    // Stream with typewriter effect
    const words = text.split(" ");
    for (const word of words) {
      display.append(word + " ");
      await sleep(30 + Math.random() * 20);
    }

    display.finish();
    console.log("\n");
  }

  private showChatHelp(): void {
    const helpContent = `
${Colors.bold}Chat Commands:${Colors.reset}
  ${Colors.cyan}/help${Colors.reset}     Show this help message
  ${Colors.cyan}/quit${Colors.reset}     Return to main menu
  ${Colors.cyan}/clear${Colors.reset}    Clear screen
  ${Colors.cyan}/model${Colors.reset}    Switch model
  ${Colors.cyan}/agent${Colors.reset}    Switch agent
  ${Colors.cyan}/status${Colors.reset}   Show current status
`;

    console.log(drawBox(helpContent, {
      title: "Help",
      color: Colors.blue,
    }));
  }

  // ==========================================
  // Model Selection
  // ==========================================

  async selectModel(): Promise<void> {
    clearScreen();
    console.log(`\n${Colors.bold}${Colors.cyan}${Emojis.gear} Select Model${Colors.reset}\n`);

    const models = this.providers.listModels();

    if (models.length === 0) {
      console.log(`${Colors.yellow}No models available. Configure API keys first.${Colors.reset}`);
      await prompt("Press Enter to continue...");
      return;
    }

    const menu = new InteractiveMenu({
      title: "Available Models",
      items: models.map((m) => ({
        label: m.fullId,
        value: m.fullId,
        icon: Emojis.brain,
        color: Colors.cyan,
      })),
    });

    const selected = await menu.show();
    this.currentModel = selected;
    console.log(`\n${Colors.green}${Emojis.check} Model set to: ${selected}${Colors.reset}`);
    await sleep(1000);
  }

  // ==========================================
  // Agent Selection
  // ==========================================

  async selectAgent(): Promise<void> {
    clearScreen();
    console.log(`\n${Colors.bold}${Colors.cyan}${Emojis.robot} Select Agent${Colors.reset}\n`);

    const agents = this.orchestrator.listAgents();

    const menu = new InteractiveMenu({
      title: "Available Agents",
      items: agents.map((a) => ({
        label: a.name,
        value: a.name,
        icon: Emojis.robot,
        description: a.description,
        color: Colors.green,
      })),
    });

    const selected = await menu.show();
    this.currentAgent = selected;
    console.log(`\n${Colors.green}${Emojis.check} Agent set to: ${selected}${Colors.reset}`);
    await sleep(1000);
  }

  // ==========================================
  // Tools View
  // ==========================================

  async showTools(): Promise<void> {
    clearScreen();
    console.log(`\n${Colors.bold}${Colors.cyan}${Emojis.wrench} Available Tools${Colors.reset}\n`);

    const tools = this.tools.list();

    const toolLines = tools.map((t) => {
      return `${Colors.green}${Emojis.check}${Colors.reset} ${Colors.bold}${t.definition.name}${Colors.reset}\n    ${Colors.dim}${t.definition.description}${Colors.reset}`;
    });

    console.log(drawBox(toolLines.join("\n\n"), {
      title: `${tools.length} Tools`,
      color: Colors.green,
    }));

    await prompt("\nPress Enter to continue...");
  }

  // ==========================================
  // Settings
  // ==========================================

  async showSettings(): Promise<void> {
    clearScreen();
    console.log(`\n${Colors.bold}${Colors.cyan}${Emojis.gear} Settings${Colors.reset}\n`);

    const menu = new InteractiveMenu({
      title: "Settings",
      items: [
        {
          label: "Change API Keys",
          value: "keys",
          icon: Emojis.key,
          description: "Configure API keys for different providers",
          color: Colors.yellow,
        },
        {
          label: "Default Model",
          value: "default_model",
          icon: Emojis.brain,
          description: `Current: ${this.currentModel}`,
          color: Colors.cyan,
        },
        {
          label: "Default Agent",
          value: "default_agent",
          icon: Emojis.robot,
          description: `Current: ${this.currentAgent}`,
          color: Colors.green,
        },
        {
          label: "Back",
          value: "back",
          icon: Emojis.arrow,
          color: Colors.gray,
        },
      ],
    });

    const choice = await menu.show();

    switch (choice) {
      case "keys":
        await this.configureApiKeys();
        break;
      case "default_model":
        await this.selectModel();
        break;
      case "default_agent":
        await this.selectAgent();
        break;
      case "back":
        return;
    }
  }

  private async configureApiKeys(): Promise<void> {
    console.log(`\n${Colors.dim}Set API keys for different providers:${Colors.reset}\n`);

    const providers = ["anthropic", "openai", "google"];

    for (const provider of providers) {
      const key = await prompt(`${provider} API key (Enter to skip):`);
      if (key) {
        this.providers.setApiKey(provider, key);
        console.log(`${Colors.green}${Emojis.check} ${provider} key set!${Colors.reset}`);
      }
    }
  }

  // ==========================================
  // Start
  // ==========================================

  async start(): Promise<void> {
    this.isRunning = true;
    clearScreen();

    // Animated startup
    const spinner = new Spinner({ text: "Initializing Deepcode...", style: "rocket" });
    spinner.start();

    await sleep(1000);
    spinner.updateText("Loading providers...");
    await sleep(500);
    spinner.updateText("Loading tools...");
    await sleep(500);
    spinner.updateText("Ready!");
    await sleep(300);

    spinner.stop(`${Emojis.party} Deepcode initialized!`);

    await sleep(500);

    await this.showMainMenu();
  }
}
