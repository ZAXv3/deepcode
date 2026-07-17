import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { resolve, relative } from "path";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// Grep Tool
// ==========================================

export class GrepTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "grep",
    description: "Search file contents using regular expressions. Returns matching files and line numbers.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The regex pattern to search for.",
        },
        path: {
          type: "string",
          description: "The directory to search in (defaults to current working directory).",
        },
        include: {
          type: "string",
          description: "File pattern to include (e.g., '*.ts', '*.{js,ts}').",
        },
      },
      required: ["pattern"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || process.cwd();
    const include = args.include as string | undefined;

    try {
      const resolvedPath = resolve(searchPath);
      
      if (!existsSync(resolvedPath)) {
        return { output: "", error: `Path not found: ${resolvedPath}` };
      }

      const regex = new RegExp(pattern, "g");
      const includeRegex = include ? this.globToRegex(include) : null;
      
      const results = await this.searchDir(resolvedPath, regex, includeRegex);

      if (results.length === 0) {
        return { output: `No matches found for pattern: ${pattern}` };
      }

      const output = results
        .slice(0, 200) // Limit to 200 results
        .map((r) => `${r.file}:${r.line}: ${r.content}`)
        .join("\n");

      return {
        output: output + (results.length > 200 ? `\n\n(Showing 200 of ${results.length} results)` : ""),
      };
    } catch (error) {
      return {
        output: "",
        error: `Failed to search: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async searchDir(
    dir: string,
    regex: RegExp,
    includeRegex: RegExp | null
  ): Promise<Array<{ file: string; line: number; content: string }>> {
    const results: Array<{ file: string; line: number; content: string }> = [];
    
    try {
      const { readdir } = await import("fs/promises");
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        
        // Skip ignored directories
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".DS_Store") {
          continue;
        }
        
        if (entry.isDirectory()) {
          results.push(...(await this.searchDir(fullPath, regex, includeRegex)));
        } else if (entry.isFile()) {
          // Check include pattern
          if (includeRegex && !includeRegex.test(entry.name)) {
            continue;
          }
          
          // Skip binary files (simple heuristic)
          if (entry.name.endsWith(".bin") || entry.name.endsWith(".exe")) {
            continue;
          }
          
          try {
            const content = await readFile(fullPath, "utf-8");
            const lines = content.split("\n");
            
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: relative(process.cwd(), fullPath),
                  line: i + 1,
                  content: lines[i].trim(),
                });
                regex.lastIndex = 0; // Reset regex state
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    
    return results;
  }

  private globToRegex(glob: string): RegExp {
    const regexStr = glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    
    return new RegExp(`^${regexStr}$`);
  }
}
