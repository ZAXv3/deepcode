import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// TodoWrite Tool
// ==========================================

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
  createdAt: Date;
  completedAt?: Date;
}

// Global todo store (per session)
const todoStore: Map<string, TodoItem[]> = new Map();

export class TodoWriteTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "todowrite",
    description: "Create, update, and manage a structured task list. Track progress on multi-step tasks.",
    parameters: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to associate todos with.",
        },
        action: {
          type: "string",
          description: "Action to perform: 'create', 'update', 'list', 'clear'.",
          enum: ["create", "update", "list", "clear"],
        },
        todos: {
          type: "array",
          description: "Array of todo items to create or update.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
      },
      required: ["sessionId", "action"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const sessionId = args.sessionId as string;
    const action = args.action as string;
    const todos = args.todos as Array<{
      id?: string;
      content?: string;
      status?: "pending" | "in_progress" | "completed" | "cancelled";
      priority?: "high" | "medium" | "low";
    }>;

    // Get or create todo list for session
    if (!todoStore.has(sessionId)) {
      todoStore.set(sessionId, []);
    }
    const sessionTodos = todoStore.get(sessionId)!;

    switch (action) {
      case "create":
        return this.createTodos(sessionTodos, todos || []);

      case "update":
        return this.updateTodos(sessionTodos, todos || []);

      case "list":
        return this.listTodos(sessionTodos);

      case "clear":
        todoStore.set(sessionId, []);
        return { output: "Todo list cleared." };

      default:
        return { output: "", error: `Unknown action: ${action}` };
    }
  }

  private createTodos(
    store: TodoItem[],
    newTodos: Array<{ content?: string; status?: string; priority?: string }>
  ): ToolResult {
    const created: TodoItem[] = [];

    for (const todo of newTodos) {
      if (!todo.content) continue;

      const item: TodoItem = {
        id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: todo.content,
        status: (todo.status as TodoItem["status"]) || "pending",
        priority: (todo.priority as TodoItem["priority"]) || "medium",
        createdAt: new Date(),
      };

      store.push(item);
      created.push(item);
    }

    return {
      output: `Created ${created.length} todo(s):\n${created.map((t) => this.formatTodo(t)).join("\n")}`,
    };
  }

  private updateTodos(
    store: TodoItem[],
    updates: Array<{ id?: string; content?: string; status?: string; priority?: string }>
  ): ToolResult {
    const updated: TodoItem[] = [];
    const notFound: string[] = [];

    for (const update of updates) {
      if (!update.id) continue;

      const index = store.findIndex((t) => t.id === update.id);
      if (index === -1) {
        notFound.push(update.id);
        continue;
      }

      const todo = store[index];
      if (update.content) todo.content = update.content;
      if (update.status) {
        todo.status = update.status as TodoItem["status"];
        if (todo.status === "completed") {
          todo.completedAt = new Date();
        }
      }
      if (update.priority) todo.priority = update.priority as TodoItem["priority"];

      updated.push(todo);
    }

    let output = `Updated ${updated.length} todo(s):\n${updated.map((t) => this.formatTodo(t)).join("\n")}`;
    if (notFound.length > 0) {
      output += `\n\nNot found: ${notFound.join(", ")}`;
    }

    return { output };
  }

  private listTodos(store: TodoItem[]): ToolResult {
    if (store.length === 0) {
      return { output: "No todos yet. Use todowrite with action='create' to add some." };
    }

    // Group by status
    const inProgress = store.filter((t) => t.status === "in_progress");
    const pending = store.filter((t) => t.status === "pending");
    const completed = store.filter((t) => t.status === "completed");
    const cancelled = store.filter((t) => t.status === "cancelled");

    const lines: string[] = [];

    if (inProgress.length > 0) {
      lines.push("**In Progress:**");
      lines.push(...inProgress.map((t) => this.formatTodo(t)));
      lines.push("");
    }

    if (pending.length > 0) {
      lines.push("**Pending:**");
      lines.push(...pending.map((t) => this.formatTodo(t)));
      lines.push("");
    }

    if (completed.length > 0) {
      lines.push("**Completed:**");
      lines.push(...completed.map((t) => this.formatTodo(t)));
      lines.push("");
    }

    if (cancelled.length > 0) {
      lines.push("**Cancelled:**");
      lines.push(...cancelled.map((t) => this.formatTodo(t)));
    }

    const total = store.length;
    const doneCount = completed.length;
    lines.push(`\nProgress: ${doneCount}/${total} (${Math.round((doneCount / total) * 100)}%)`);

    return { output: lines.join("\n") };
  }

  private formatTodo(todo: TodoItem): string {
    const statusIcon = {
      pending: "⬜",
      in_progress: "🔄",
      completed: "✅",
      cancelled: "❌",
    }[todo.status];

    const priorityIcon = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    }[todo.priority];

    return `${statusIcon} ${priorityIcon} \`${todo.id.slice(-6)}\` ${todo.content}`;
  }
}
