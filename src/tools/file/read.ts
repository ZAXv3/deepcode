import { readFile, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// Read Tool
// ==========================================

export class ReadTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "read",
    description: "Read a file from the local filesystem. Use this when you need to see the contents of a file.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to read.",
        },
        offset: {
          type: "number",
          description: "The line number to start reading from (1-indexed).",
        },
        limit: {
          type: "number",
          description: "The maximum number of lines to read.",
        },
      },
      required: ["filePath"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.filePath as string;
    const offset = (args.offset as number) || 1;
    const limit = (args.limit as number) || 2000;

    try {
      const resolvedPath = resolve(filePath);
      
      if (!existsSync(resolvedPath)) {
        return { output: "", error: `File not found: ${resolvedPath}` };
      }

      const fileStat = await stat(resolvedPath);
      if (fileStat.isDirectory()) {
        return { output: "", error: `Path is a directory: ${resolvedPath}. Use list tool instead.` };
      }

      const content = await readFile(resolvedPath, "utf-8");
      const lines = content.split("\n");
      
      const startLine = Math.max(1, offset);
      const endLine = Math.min(lines.length, startLine + limit - 1);
      const slicedLines = lines.slice(startLine - 1, endLine);

      const output = slicedLines
        .map((line, i) => `${startLine + i}: ${line}`)
        .join("\n");

      return {
        output: output + (endLine < lines.length ? `\n\n(Showing lines ${startLine}-${endLine} of ${lines.length})` : ""),
      };
    } catch (error) {
      return {
        output: "",
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
