import { Tool, ToolDefinition, ToolResult } from "../index.js";
import { spawn } from "child_process";

// ==========================================
// Subagent Tool - Mass Delegation
// ==========================================

export class SubagentTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "subagent",
    description: "Spawn a sub-agent to handle a complex task autonomously. Supports mass delegation for parallel tasks.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task description for the sub-agent to complete.",
        },
        agent: {
          type: "string",
          description: "Agent type to spawn: 'general', 'explore', 'build', 'plan'.",
          enum: ["general", "explore", "build", "plan"],
        },
        model: {
          type: "string",
          description: "Optional model override for the sub-agent.",
        },
        parallel: {
          type: "boolean",
          description: "If true, spawn multiple sub-agents for independent subtasks.",
        },
        tasks: {
          type: "array",
          description: "Array of tasks for mass delegation (used with parallel=true).",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              task: { type: "string" },
            },
          },
        },
      },
      required: ["task"],
    },
  };

  // Store orchestrator reference (set by tool registration)
  orchestrator: any = null;

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const task = args.task as string;
    const agent = (args.agent as string) || "general";
    const model = args.model as string | undefined;
    const parallel = args.parallel as boolean;
    const tasks = args.tasks as Array<{ id?: string; task: string }> | undefined;

    if (!this.orchestrator) {
      return { output: "", error: "Orchestrator not connected to subagent tool" };
    }

    try {
      if (parallel && tasks && tasks.length > 0) {
        return await this.massDelegation(tasks, agent, model);
      }

      // Single task delegation
      const result = await this.orchestrator.spawnSubagent(
        this.orchestrator["sessions"].keys().next().value || "",
        agent,
        task
      );

      return { output: result };
    } catch (error: any) {
      return { output: "", error: `Subagent failed: ${error.message || String(error)}` };
    }
  }

  private async massDelegation(
    tasks: Array<{ id?: string; task: string }>,
    agent: string,
    model?: string
  ): Promise<ToolResult> {
    const results: Array<{ id: string; status: "success" | "error"; output: string }> = [];

    // Execute tasks in parallel
    const promises = tasks.map(async (task, index) => {
      const id = task.id || `task_${index + 1}`;
      try {
        const result = await this.orchestrator.spawnSubagent(
          this.orchestrator["sessions"].keys().next().value || "",
          agent,
          task.task
        );
        return { id, status: "success" as const, output: result };
      } catch (error: any) {
        return { id, status: "error" as const, output: error.message || String(error) };
      }
    });

    const taskResults = await Promise.all(promises);
    results.push(...taskResults);

    // Format output
    const output = results
      .map((r) => {
        const icon = r.status === "success" ? "✓" : "✗";
        const color = r.status === "success" ? "\x1b[32m" : "\x1b[31m";
        return `${color}${icon}\x1b[0m ${r.id}: ${r.output.slice(0, 200)}${r.output.length > 200 ? "..." : ""}`;
      })
      .join("\n");

    return {
      output: `Mass delegation complete (${results.length} tasks):\n${output}`,
    };
  }
}
