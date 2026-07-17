import { ToolRegistry } from "./index.js";
import { ReadTool } from "./file/read.js";
import { WriteTool } from "./file/write.js";
import { EditTool } from "./file/edit.js";
import { GlobTool } from "./search/glob.js";
import { GrepTool } from "./search/grep.js";
import { BashTool } from "./shell/bash.js";
import { WebFetchTool } from "./web/webfetch.js";
import { WebSearchTool } from "./web/websearch.js";
import { TodoWriteTool } from "./management/todowrite.js";

// ==========================================
// Register All Built-in Tools
// ==========================================

export function registerBuiltinTools(registry: ToolRegistry): void {
  // File operations
  registry.register(new ReadTool());
  registry.register(new WriteTool());
  registry.register(new EditTool());

  // Search
  registry.register(new GlobTool());
  registry.register(new GrepTool());

  // Shell
  registry.register(new BashTool());

  // Web
  registry.register(new WebFetchTool());
  registry.register(new WebSearchTool());

  // Management
  registry.register(new TodoWriteTool());
}
