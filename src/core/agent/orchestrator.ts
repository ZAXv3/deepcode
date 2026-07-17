import { Agent, AgentConfig, AgentContext, BUILTIN_AGENTS } from "./types.js";
import { ProviderRegistry } from "../provider/index.js";
import { ToolRegistry } from "../../tools/index.js";
import { Message } from "../provider/types.js";

// ==========================================
// Agent Orchestrator
// ==========================================

export interface OrchestratorConfig {
  providers: ProviderRegistry;
  tools: ToolRegistry;
  model: string;
  smallModel?: string;
  workDir: string;
}

export class AgentOrchestrator {
  private providers: ProviderRegistry;
  private tools: ToolRegistry;
  private model: string;
  private smallModel: string;
  private workDir: string;
  private agents: Map<string, AgentConfig> = new Map();
  private sessions: Map<string, AgentSession> = new Map();

  constructor(config: OrchestratorConfig) {
    this.providers = config.providers;
    this.tools = config.tools;
    this.model = config.model;
    this.smallModel = config.smallModel || config.model;
    this.workDir = config.workDir;

    // Register built-in agents
    for (const [name, config] of Object.entries(BUILTIN_AGENTS)) {
      this.agents.set(name, config);
    }
  }

  // ==========================================
  // Session Management
  // ==========================================

  createSession(agentName?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const agent = this.agents.get(agentName || "build") || this.agents.get("build")!;

    this.sessions.set(sessionId, {
      id: sessionId,
      agent,
      messages: [],
      startedAt: new Date(),
    });

    return sessionId;
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ==========================================
  // Message Processing
  // ==========================================

  async processMessage(
    sessionId: string,
    userMessage: string,
    options?: {
      model?: string;
      tools?: boolean;
      stream?: boolean;
    }
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message to history
    session.messages.push({
      role: "user",
      content: userMessage,
    });

    // Build context
    const model = options?.model || session.agent.model || this.model;
    const tools = options?.tools !== false ? this.tools.getDefinitions() : [];

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(session);

    // Prepare messages for API
    const apiMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...session.messages,
    ];

    // Call provider
    const response = await this.providers.chat({
      model,
      messages: apiMessages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: session.agent.temperature,
    });

    // Process response and handle tool calls
    let finalResponse = "";
    const assistantContent: Message["content"] = [];

    for (const item of response.content) {
      if (item.type === "text") {
        finalResponse += item.text;
        assistantContent.push(item);
      } else if (item.type === "tool_use") {
        // Execute tool
        const toolResult = await this.tools.execute(item.name, item.input);
        
        // Add tool call and result to history
        assistantContent.push(item);
        session.messages.push({
          role: "assistant",
          content: assistantContent,
        });
        session.messages.push({
          role: "tool",
          content: [{
            type: "tool_result",
            tool_use_id: item.id,
            content: toolResult.output || toolResult.error || "",
            is_error: !!toolResult.error,
          }],
        });

        // If tool produced output, we need to continue the conversation
        // to let the model process the result
        const continueResponse = await this.providers.chat({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...session.messages,
          ],
          tools: tools.length > 0 ? tools : undefined,
        });

        for (const continueItem of continueResponse.content) {
          if (continueItem.type === "text") {
            finalResponse += continueItem.text;
          }
        }
      }
    }

    // Add assistant response to history
    if (assistantContent.length > 0 && !session.messages.some(m => 
      m.role === "assistant" && Array.isArray(m.content) && 
      m.content.some(c => c.type === "tool_use")
    )) {
      session.messages.push({
        role: "assistant",
        content: assistantContent,
      });
    }

    return finalResponse;
  }

  private buildSystemPrompt(session: AgentSession): string {
    const parts: string[] = [];

    // Agent's base prompt
    if (session.agent.prompt) {
      parts.push(session.agent.prompt);
    }

    // Add context about available tools
    parts.push(`
You have access to the following tools:
${this.tools.list().map(t => `- ${t.definition.name}: ${t.definition.description}`).join("\n")}

Working directory: ${this.workDir}
Current date: ${new Date().toISOString().split("T")[0]}
`);

    return parts.join("\n\n");
  }

  // ==========================================
  // Agent Management
  // ==========================================

  registerAgent(config: AgentConfig): void {
    this.agents.set(config.name, config);
  }

  getAgent(name: string): AgentConfig | undefined {
    return this.agents.get(name);
  }

  listAgents(): AgentConfig[] {
    return Array.from(this.agents.values()).filter(a => !a.hidden);
  }

  // ==========================================
  // Subagent Spawning
  // ==========================================

  async spawnSubagent(
    parentSessionId: string,
    agentName: string,
    task: string
  ): Promise<string> {
    const parentSession = this.sessions.get(parentSessionId);
    if (!parentSession) {
      throw new Error(`Parent session not found: ${parentSessionId}`);
    }

    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    // Create new session for subagent
    const subagentSessionId = this.createSession(agentName);
    const subagentSession = this.sessions.get(subagentSessionId)!;

    // Copy relevant context from parent
    const recentMessages = parentSession.messages.slice(-5);
    subagentSession.messages = [...recentMessages];

    // Process the task
    const result = await this.processMessage(subagentSessionId, task, {
      model: agent.model || this.smallModel,
    });

    return result;
  }
}

// ==========================================
// Agent Session
// ==========================================

export interface AgentSession {
  id: string;
  agent: AgentConfig;
  messages: Message[];
  startedAt: Date;
}
