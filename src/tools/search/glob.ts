import { readdir, stat } from "fs/promises";
import { resolve, relative, join } from "path";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// Glob Tool
// ==========================================

export class GlobTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "glob",
    description: "Find files matching a glob pattern. Returns matching file paths.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The glob pattern to match (e.g., '**/*.ts', 'src/**/*.js').",
        },
        path: {
          type: "string",
          description: "The directory to search in (defaults to current working directory).",
        },
      },
      required: ["pattern"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || process.cwd();

    try {
      const resolvedPath = resolve(searchPath);
      const files = await this.walkDir(resolvedPath);
      const matches = this.matchFiles(files, resolvedPath, pattern);

      if (matches.length === 0) {
        return { output: `No files found matching pattern: ${pattern}` };
      }

      return {
        output: matches.join("\n") + `\n\n(${matches.length} files found)`,
      };
    } catch (error) {
      return {
        output: "",
        error: `Failed to search files: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async walkDir(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        // Skip node_modules, .git, etc.
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".DS_Store") {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...(await this.walkDir(fullPath)));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    
    return files;
  }

  private matchFiles(files: string[], basePath: string, pattern: string): string[] {
    const regex = this.globToRegex(pattern);
    
    return files
      .map((f) => relative(basePath, f))
      .filter((f) => regex.test(f))
      .sort();
  }

  private globToRegex(glob: string): RegExp {
    let regexStr = glob
      // Escape special regex characters
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // Convert ** to a placeholder
      .replace(/\*\*/g, "{{DOUBLE_STAR}}")
      // Convert * to match anything except /
      .replace(/\*/g, "[^/]*")
      // Convert ? to match single character except /
      .replace(/\?/g, "[^/]")
      // Convert {{DOUBLE_STAR}} to match anything
      .replace(/{{DOUBLE_STAR}}/g, ".*");
    
    // Handle directory patterns (e.g., src/ -> src/)
    if (glob.endsWith("/")) {
      regexStr += "/";
    }
    
    return new RegExp(`^${regexStr}$`);
  }
}
