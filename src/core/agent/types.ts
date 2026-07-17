import { Message, ToolDefinition } from "../provider/types.js";

// ==========================================
// Agent Types
// ==========================================

export type AgentMode = "primary" | "subagent" | "all";

export interface AgentConfig {
  name: string;
  description?: string;
  model?: string;
  mode: AgentMode;
  hidden?: boolean;
  disable?: boolean;
  permission?: Record<string, any>;
  prompt?: string;
  temperature?: number;
  color?: string;
  steps?: string[];
}

export interface AgentContext {
  agent: AgentConfig;
  messages: Message[];
  tools: ToolDefinition[];
  workingDirectory: string;
  session: SessionInfo;
}

export interface SessionInfo {
  id: string;
  startedAt: Date;
  messageCount: number;
}

// ==========================================
// Agent Base Class
// ==========================================

export abstract class Agent {
  abstract readonly config: AgentConfig;

  abstract processMessage(
    message: string,
    context: AgentContext
  ): Promise<string>;
}

// ==========================================
// Built-in Agent Configs
// ==========================================

export const BUILTIN_AGENTS: Record<string, AgentConfig> = {
  build: {
    name: "build",
    description: "Primary agent for coding tasks. Reads, writes, and edits code.",
    mode: "primary",
    color: "blue",
    prompt: `You are Deepcode, an AI coding assistant. You help users with coding tasks by reading, writing, and editing files, running commands, and providing guidance.

Key principles:
- Be concise and direct
- Show code changes, don't just describe them
- Verify your work when possible
- Ask for clarification when requirements are unclear`,
  },
  plan: {
    name: "plan",
    description: "Planning agent for thinking through complex tasks before implementation.",
    mode: "primary",
    color: "yellow",
    prompt: `You are a planning agent. You help users think through complex tasks before implementation.

Your role:
- Break down complex problems into steps
- Identify potential issues and risks
- Suggest architectural approaches
- Do NOT make changes - only plan them
- Ask clarifying questions to understand requirements`,
  },
  general: {
    name: "general",
    description: "General-purpose agent for research and complex multi-step tasks.",
    mode: "all",
    color: "green",
    prompt: `You are a general-purpose AI assistant. You can help with research, analysis, writing, and complex multi-step tasks.

Key principles:
- Be thorough and accurate
- Break complex tasks into manageable steps
- Provide clear explanations
- Cite sources when possible`,
  },
  explore: {
    name: "explore",
    description: "Code exploration agent for understanding codebases.",
    mode: "all",
    color: "cyan",
    prompt: `You are a code exploration agent. You help users understand codebases by finding files, searching code, and explaining structures.

Key principles:
- Be thorough in your search
- Explain code structure clearly
- Highlight important patterns
- Suggest related files or areas to explore`,
  },
};
