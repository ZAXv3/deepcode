import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// Write Tool
// ==========================================

export class WriteTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "write",
    description: "Write content to a file. This will overwrite the file if it exists, or create it if it doesn't.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to write.",
        },
        content: {
          type: "string",
          description: "The content to write to the file.",
        },
      },
      required: ["filePath", "content"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.filePath as string;
    const content = args.content as string;

    try {
      const resolvedPath = resolve(filePath);
      const dir = dirname(resolvedPath);

      // Create directory if it doesn't exist
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(resolvedPath, content, "utf-8");

      return {
        output: `Successfully wrote ${content.length} bytes to ${resolvedPath}`,
      };
    } catch (error) {
      return {
        output: "",
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
