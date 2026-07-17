import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// Edit Tool
// ==========================================

export class EditTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "edit",
    description: "Performs exact string replacements in files. Use this to make targeted edits to existing files.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to modify.",
        },
        oldString: {
          type: "string",
          description: "The text to replace (must match exactly, including indentation).",
        },
        newString: {
          type: "string",
          description: "The text to replace it with (must be different from oldString).",
        },
        replaceAll: {
          type: "boolean",
          description: "Replace all occurrences of oldString (default: false).",
        },
      },
      required: ["filePath", "oldString", "newString"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.filePath as string;
    const oldString = args.oldString as string;
    const newString = args.newString as string;
    const replaceAll = (args.replaceAll as boolean) || false;

    try {
      const resolvedPath = resolve(filePath);

      if (!existsSync(resolvedPath)) {
        return { output: "", error: `File not found: ${resolvedPath}` };
      }

      if (oldString === newString) {
        return { output: "", error: "oldString and newString must be different" };
      }

      const content = await readFile(resolvedPath, "utf-8");

      // Check if oldString exists
      if (!content.includes(oldString)) {
        return { output: "", error: "oldString not found in content" };
      }

      // Count occurrences
      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1 && !replaceAll) {
        return {
          output: "",
          error: `Found multiple matches for oldString (${occurrences} occurrences). Provide more surrounding lines to identify the correct match, or use replaceAll.`,
        };
      }

      // Perform replacement
      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      await writeFile(resolvedPath, newContent, "utf-8");

      return {
        output: replaceAll
          ? `Replaced ${occurrences} occurrences of oldString`
          : "Successfully replaced oldString",
      };
    } catch (error) {
      return {
        output: "",
        error: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
